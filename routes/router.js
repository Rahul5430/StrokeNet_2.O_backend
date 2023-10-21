const express = require("express");
const router = express.Router();
const User = require("../models/UserCollection");
const {
  getCenters,
  getHubs,
  globalSettings,
} = require("../controller/GlobalController");
const { signup, login } = require("../controller/authController");
const {
  addPatient,
  getUserPatients,
  getSinglePatient,
  updateBasicData,
  updateScanTimesofPatient,
  updatePatientComplications,
  updateNIHSSofPatient
} = require("../controller/PatientController");

router.post("/auth/signup", signup);
router.post("/auth/login", login);
router.post("/patients/add_patient", addPatient);
router.get("/patients/user_patients", getUserPatients);
router.post("/patients/update_patient_basic_data", updateBasicData);
router.post("/patients/update_patient_scan_times", updateScanTimesofPatient);
router.post("/patients/update_patient_complications", updatePatientComplications);
router.post("/patients/update_patient_nihss", updateNIHSSofPatient);
router.get("/patients/patient/:id", getSinglePatient);
router.get("/get_hubs", getHubs);
router.get("/get_centers", getCenters);
router.get("/get_global_settings", globalSettings);

module.exports = router;
