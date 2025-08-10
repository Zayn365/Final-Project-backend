// models/StudentData.js
const mongoose = require("mongoose");

const StudentDataSchema = new mongoose.Schema(
  {
    Okul: String, // school name
    Ogrenci_Ad: String, // student full name
    Ogrenci_TC: String, // student national id (username)
    Sinif_Seviyesi: String, // grade level
    Veli_Turu: String, // parent type (Anne/Baba)
    Veli_Ad: String, // parent name
    Veli_TC: String, // parent tc (if present)
  },
  {
    collection: "studentData",
    strict: false, // allow extra fields from your import
  }
);

module.exports = mongoose.model("StudentData", StudentDataSchema);
