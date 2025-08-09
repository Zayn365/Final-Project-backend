const fetch = require("node-fetch");
const { XMLParser } = require("fast-xml-parser");
const User = require("../models/User");
// checvk
exports.k12LoginAndFetch = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Step 1: Login to K12NET
    const loginRes = await fetch(
      "https://okul.k12net.com/GWCore.Web/api/Login/Validate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          UserName: username,
          Password: password,
          CreatePersistentCookie: true,
        }),
      }
    );

    const cookie = loginRes.headers.raw()["set-cookie"]?.[0]?.split(";")[0];
    if (!cookie) {
      return res
        .status(401)
        .json("Invalid K12 credentials or session not created");
    }

    const parser = new XMLParser({ ignoreAttributes: false });

    // Step 2: Fetch personal info
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
          Cookie: cookie,
        },
        body: personalInfoSoap,
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

    // Step 3: Fetch student data
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
          Cookie: cookie,
        },
        body: studentSoapBody,
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

    // Step 4: Find or create user
    let user = await User.findOne({ email: parentEmail });

    if (user) {
      user.k12Cookie = cookie;
      user.k12 = {
        schoolName,
        students,
      };
      await user.save(); // Save updated values

      return res.json(user.toJSON());
    }
    user = await User.create({
      name: parentName,
      username: username,
      email: parentEmail,
      phone: parentPhone,
      tc_id: ogrenciTc,
      password: password,
      k12: {
        schoolName,
        students,
      },
      k12Cookie: cookie,
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
