const fetch = require("node-fetch");
const { XMLParser } = require("fast-xml-parser");
const User = require("../models/User");

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
    });

    return res.json(user.toJSON());
  } catch (error) {
    console.error("K12 Login Error:", error);
    return res.status(500).json("Something went wrong during K12 login");
  }
};
