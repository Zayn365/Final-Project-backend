const fetch = require("node-fetch");
const { XMLParser } = require("fast-xml-parser");
const User = require("../models/User");
const StudentData = require("../models/StudentData");

function splitName(full = "") {
  const parts = String(full || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

// digits-only, as string
function normalizeTc(v) {
  return String(v || "").replace(/\D/g, "");
}

exports.k12LocalLogin = async (req, res) => {
  try {
    const { username, password } = req.body; // username = Ogrenci_TC
    const tcStr = String(username || "").trim();
    if (!tcStr)
      return res.status(400).json({ error: "Öğrenci TC is required" });

    // 1) Load all docs and filter locally
    const all = await StudentData.find({}).lean(); // <-- await
    const norm = (v) => String(v ?? "").replace(/\D/g, "");
    const rows = all.filter((r) => norm(r.Ogrenci_TC) === norm(tcStr));

    if (!rows.length)
      return res.status(401).json({ error: "No student found for this TC" });

    // 2) Build profile from first hit + aggregate rows
    const primary = rows[0];
    const schoolName = primary.Okul || "";
    const parentName = primary.Veli_Adi || primary["Veli_Adı"] || "";
    const studentFullName = primary["Ogrenci_Adı"] || "";

    const students = rows.map((r, i) => {
      const full = r["Ogrenci_Adı"] || "";
      const [firstName, ...rest] = full.trim().split(/\s+/);
      return {
        firstName,
        lastName: rest.join(" "),
        studentId: `${tcStr}-${i + 1}`,
        studentTc: tcStr,
        gradeLevel: String(r["Sınıf_Seviyesi"] ?? ""),
        membershipType: r.Veli_Turu || "",
      };
    });

    const displayName = parentName || studentFullName.split(/\s+/)[0] || tcStr;
    const email = `${tcStr}@k12.local`;

    // 3) Upsert user
    let user = await User.findOne({ tc_id: tcStr });
    if (user) {
      user.name = displayName;
      user.username = tcStr;
      user.email ||= email;
      user.k12 = { schoolName, students };
      await user.save();
    } else {
      user = await User.create({
        name: displayName,
        username: tcStr,
        email,
        phone: null,
        tc_id: tcStr,
        password,
        k12: { schoolName, students },
        k12Cookie: null,
      });
    }

    return res.json(user.toJSON());
  } catch (err) {
    console.error("k12LocalLogin error:", err);
    return res.status(500).json({ error: "Local K12 login failed" });
  }
};

exports.k12LoginAndFetch = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1) Login (do NOT auto-follow)
    const loginRes = await fetch(
      "https://okul.k12net.com/GWCore.Web/api/Login/Validate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Some servers gate on UA; optional but can help:
          "User-Agent": "Mozilla/5.0 NodeFetch/undici",
        },
        body: JSON.stringify({
          UserName: username,
          Password: password,
          CreatePersistentCookie: true,
        }),
      }
    );

    // Try both undici helper and raw get()
    const setCookies = loginRes.headers.getSetCookie
      ? loginRes.headers.getSetCookie()
      : [];
    console.log("TCL ~ setCookies:", setCookies);
    const rawSetCookieHeader = loginRes.headers.get("set-cookie"); // may be null or a single string
    console.log("TCL ~ rawSetCookieHeader:", rawSetCookieHeader);
    if (rawSetCookieHeader && setCookies.length === 0) {
      // split on comma only when it looks like multiple cookies; safest is to also look for 'Path=' boundaries
      // but most servers send multiple Set-Cookie lines. Undici flattens; we try a conservative split:
      const maybeMany = rawSetCookieHeader.split(/,(?=\s*[A-Za-z0-9_.-]+=)/g);
      setCookies.push(...maybeMany);
    }

    // Pull a cookie that contains K12NETAUTH
    const rawCookie = setCookies.find((c) => /K12NETAUTH/i.test(c)) || null;
    console.log("TCL ~ rawCookie:", rawCookie);

    if (!rawCookie) {
      // TEMP DEBUG to see what we got back (remove in production)
      const hdrs = {};
      for (const [k, v] of loginRes.headers) hdrs[k] = v;
      console.error("Login response status:", loginRes.status);
      console.error("Login response headers:", hdrs);
      const peek = await loginRes.text().catch(() => "");
      console.error("Login response body (peek):", peek.slice(0, 500));
      return res
        .status(401)
        .json({ error: "K12 login failed - session cookie missing" });
    }

    // Keep only "name=value"
    const sessionCookie = rawCookie.split(";")[0].trim();

    // If the login responded with a redirect, follow it once with the cookie (some setups finalize session on GET)
    if (loginRes.status >= 300 && loginRes.status < 400) {
      const location = loginRes.headers.get("location");
      if (location) {
        await fetch(location, {
          method: "GET",
          headers: {
            Cookie: sessionCookie,
            "User-Agent": "Mozilla/5.0 NodeFetch/undici",
          },
          redirect: "manual",
        }).catch(() => {});
      }
    }

    const parser = new XMLParser({ ignoreAttributes: false });

    // 2) Personal info SOAP
    const personalInfoSoap = `
      <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
        <s:Body>
          <GetPersonalInfoSummary xmlns="http://tempuri.org/" />
        </s:Body>
      </s:Envelope>`;

    const personalRes = await fetch(
      "https://okul.k12net.com/K12NETDataService/K12NETDataService.svc",
      {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction:
            '"http://tempuri.org/IK12NETService/GetPersonalInfoSummary"',
          Cookie: sessionCookie,
          "User-Agent": "Mozilla/5.0 NodeFetch/undici",
        },
        body: personalInfoSoap,
        redirect: "manual",
      }
    );

    const personalXml = await personalRes.text();
    const personalParsed = parser.parse(personalXml);
    const personalData =
      personalParsed?.["s:Envelope"]?.["s:Body"]?.[
        "GetPersonalInfoSummaryResponse"
      ]?.["GetPersonalInfoSummaryResult"];

    const parentEmail =
      personalData?.["a:Emails"]?.["b:string"] || `${username}@k12.net`;
    const parentName = `${personalData?.["a:FirstName"] || ""} ${
      personalData?.["a:LastName"] || ""
    }`.trim();
    const parentPhone =
      personalData?.["a:PhoneNumbers"]?.["a:Phone"]?.["a:Number"] || null;

    // 3) Students SOAP
    const studentSoapBody = `
      <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
        <s:Body>
          <GetStudent xmlns="http://tempuri.org/">
            <schoolYearID>2026</schoolYearID>
            <locationInfoID>28c02d66-a092-ee11-813a-bc97e1afd933</locationInfoID>
          </GetStudent>
        </s:Body>
      </s:Envelope>`;

    const studentRes = await fetch(
      "https://okul.k12net.com/K12NETDataService/K12NETDataService.svc",
      {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: '"http://tempuri.org/IK12NETService/GetStudent"',
          Cookie: sessionCookie,
          "User-Agent": "Mozilla/5.0 NodeFetch/undici",
        },
        body: studentSoapBody,
        redirect: "manual",
      }
    );

    const studentXml = await studentRes.text();
    const studentParsed = parser.parse(studentXml);
    const studentData =
      studentParsed?.["s:Envelope"]?.["s:Body"]?.["GetStudentResponse"]?.[
        "GetStudentResult"
      ]?.["a:StudentInfo"];

    const studentArray = Array.isArray(studentData)
      ? studentData
      : studentData
      ? [studentData]
      : [];
    const firstStudent = studentArray[0];
    const ogrenciTc = firstStudent?.["a:OtherID"];
    const schoolName = firstStudent?.["a:SchoolName"];

    const students = studentArray.map((s) => ({
      firstName: s["a:FirstName"],
      lastName: s["a:LastName"],
      studentId: s["a:StudentID"],
      studentTc: s["a:OtherID"],
      gradeLevel: s["a:GradeLevel"],
      birthDate: s["a:BirthDate"],
      entryDate: s["a:EntryDate"],
      stateOfBirth: s["a:StateOfBirth"],
      membershipType: s["a:MembershipType"],
      schoolInfoId: s["a:SchoolInfoID"],
      schoolYearId: s["a:SchoolYearID"],
      localId: s["a:LocalID"],
    }));

    // 4) Upsert user
    let user = await User.findOne({ email: parentEmail });
    if (user) {
      user.k12Cookie = sessionCookie;
      user.k12 = { schoolName, students };
      await user.save();
      return res.json(user.toJSON());
    }

    user = await User.create({
      name: parentName || username,
      username,
      email: parentEmail,
      phone: parentPhone,
      tc_id: ogrenciTc,
      password,
      k12: { schoolName, students },
      k12Cookie: sessionCookie,
    });

    return res.json(user.toJSON());
  } catch (error) {
    console.error("K12 Login Error:", error);
    return res.status(500).json("Something went wrong during K12 login");
  }
};
exports.createK12SaleContract = async (req, res) => {
  try {
    const { userId: userIdFromBody, password, data: salesData } = req.body;
    const userId = req.user?._id || userIdFromBody;

    const user = await User.findById(userId);
    if (!user || !user.username) {
      return res
        .status(400)
        .json({ error: "User or K12 login credentials not found" });
    }

    // Step 1: Login to K12NET
    const loginResponse = await fetch(
      "https://okul.k12net.com/GWCore.Web/api/Login/Validate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          UserName: user.username,
          Password: password,
        }),
      }
    );

    const allCookies = loginResponse.headers.raw()["set-cookie"] || [];

    // Extract .AspNetCore.K12NETAUTH cookie
    const loginCookie = allCookies
      .find((c) => c.includes(".AspNetCore..K12NETAUTH"))
      ?.split(";")[0];
    if (!loginCookie) {
      return res
        .status(401)
        .json({ error: "K12 login failed - session cookie missing" });
    }

    // Step 2: Send Sales Contract
    const response = await fetch(
      "https://okul.k12net.com/INTCore.Web/api/SalesContracts/Create",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: loginCookie,
        },
        body: JSON.stringify(salesData),
      }
    );

    const json = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ success: false, result: json });
    }

    return res.status(200).json({
      success: true,
      result: json,
    });
  } catch (error) {
    console.error("K12 Sale Contract Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};
