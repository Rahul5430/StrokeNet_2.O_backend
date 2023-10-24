const express = require("express");
const router = express.Router();
const User = require("../models/UserCollection");
const {
  getCenters,
  getHubs,
  globalSettings,
  getSinglePage,
} = require("../controller/GlobalController");
const { signup, login, validateUser } = require("../controller/authController");
const {
  addPatient,
  getUserPatients,
  getSinglePatient,
  updateBasicData,
  updateScanTimesofPatient,
  updatePatientComplications,
  updateNIHSSofPatient,
  updateMRSofPatient,
  scansUploadedAlertToTeam,
  addPatientScanFile,
} = require("../controller/PatientController");
const {changeOnlineStatus} = require("../controller/userController");

router.post("/auth/signup", signup);
router.post("/auth/login", login);
router.get("/auth/validateUser", validateUser);
router.get("/auth/update_online_status", changeOnlineStatus);
router.post("/patients/add_patient", addPatient);
router.get("/patients/user_patients", getUserPatients);
router.post("/patients/update_patient_basic_data", updateBasicData);
router.post("/patients/update_patient_scan_times", updateScanTimesofPatient);
router.post("/patients/files/add_file",addPatientScanFile);
router.post("/patients/update_scans_uploaded", scansUploadedAlertToTeam);
router.post(
  "/patients/update_patient_complications",
  updatePatientComplications
);
router.post("/patients/update_patient_nihss", updateNIHSSofPatient);
router.post("/patients/update_patient_mrs", updateMRSofPatient);
router.get("/patients/patient/:id", getSinglePatient);
router.get("/get_hubs", getHubs);
router.get("/get_centers", getCenters);
router.get("/get_global_settings", globalSettings);
router.get("/page/:pageId", getSinglePage);

module.exports = router;
