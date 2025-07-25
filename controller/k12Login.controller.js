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

    // Step 2: Fetch student data
    const soapBody = `
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
        body: soapBody,
      }
    );

    const xmlText = await studentRes.text();
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xmlText);

    const student =
      parsed?.["s:Envelope"]?.["s:Body"]?.["GetStudentResponse"]?.[
        "GetStudentResult"
      ]?.["a:StudentInfo"];

    if (!student) {
      return res.status(400).send("Student info not found");
    }

    // Extract fields
    const veliTc = student["a:UserName"]?.toString();
    const ogrenciTc = student["a:OtherID"]?.toString();
    const email = `${ogrenciTc}@k12.net`; // apply new logic

    const parentName =
      student?.["a:EntryType"]?.["a:OtherCodes"]?.["a:CustomCode"]?.[
        "a:Value"
      ] || "Unnamed Parent";
    const schoolName = student["a:SchoolName"];

    const students = [
      {
        firstName: student["a:FirstName"],
        lastName: student["a:LastName"],
        studentId: student["a:StudentID"],
        studentTc: ogrenciTc,
        gradeLevel: student["a:GradeLevel"],
        birthDate: student["a:BirthDate"],
        entryDate: student["a:EntryDate"],
        stateOfBirth: student["a:StateOfBirth"],
        membershipType: student["a:MembershipType"],
        schoolInfoId: student["a:SchoolInfoID"],
        schoolYearId: student["a:SchoolYearID"],
        localId: student["a:LocalID"],
      },
    ];

    // Step 3: Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      // Return existing user
      return res.json(user.toJSON());
    }

    // Step 4: Create new user
    user = await User.create({
      name: parentName,
      username: username, // Veli TC
      email: email, // studentTc@k12.net
      tc_id: ogrenciTc, // Actual student TC
      password: password, // Will be hashed via pre-save hook
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
