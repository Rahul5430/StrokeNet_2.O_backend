const express = require("express");
const router = express.Router();
const User = require("../models/UserCollection");
const path = require("path");
const {
  getCenters,
  getHubs,
  globalSettings,
  getSinglePage,
  uploadFile,
} = require("../controller/GlobalController");

const { fetchAllOnlineUsers } = require("../controller/ConversationController");

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
  deletePatientFile,
  codeStrokeAlert,
} = require("../controller/PatientController");
const {
  postTransitionStatus,
} = require("../controller/PatientAnalysisController");
const {
  changeOnlineStatus,
  GetUsersForAdmin,
  UserVerification,
  RemoveUser,
} = require("../controller/userController");

const {
  sendOTPCode,
  verifyOTP,
  sendEmailCode,
  verifyEmailOtp,
} = require("../controller/OtpController");

const multer = require("multer");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const absolutePath = path.join(__dirname, "../public/files/");
    return cb(null, absolutePath);
  },
  filename: async function (req, file, cb) {
    const filename = `${Date.now()}-${file.originalname}`;
    return cb(null, filename);
  },
});
const upload = multer({ storage: storage });

router.post("/upload", upload.single("file"), uploadFile);
router.post("/UserVerification", UserVerification);
router.post("/RemoveUser", RemoveUser);
router.get("/getUsers", GetUsersForAdmin);
router.get("/conversations/get_all_online_users", fetchAllOnlineUsers);
router.post("/auth/signup", signup);
router.post("/auth/login", login);
router.post("/sms/send_otp", sendOTPCode);
router.post("/email/send_otp", sendEmailCode);
router.post("/sms/verify_otp", verifyOTP);
router.post("/email/verify_otp", verifyEmailOtp);
router.get("/auth/validateUser", validateUser);
router.get("/auth/update_online_status", changeOnlineStatus);
router.post("/patients/add_patient", addPatient);
router.post("/patients/code_stroke_alert_manually", codeStrokeAlert);
router.post("/patient_analysis/post_transition_status", postTransitionStatus);
router.get("/patients/user_patients", getUserPatients);
router.post("/patients/update_patient_basic_data", updateBasicData);
router.post("/patients/update_patient_scan_times", updateScanTimesofPatient);
router.post("/patients/files/add_file", addPatientScanFile);
router.post("/patients/update_scans_uploaded", scansUploadedAlertToTeam);
router.post("/patients/files/delete_file", deletePatientFile);
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
