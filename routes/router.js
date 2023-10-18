const express = require('express');
const router = express.Router();
const User = require('../models/UserCollection');
const {getCenters,getHubs,globalSettings} = require("../controller/GlobalController");
const {signup,login} = require("../controller/authController");
const {addPatient,getUserPatients,getSinglePatient} = require("../controller/PatientController");

router.post('/auth/signup',signup);
router.post('/auth/login',login);
router.post('/patients/add_patient',addPatient);
router.post('/patients/user_patients',getUserPatients);
router.get('/patients/patient/:id',getSinglePatient);
router.get('/get_hubs',getHubs);
router.get('/get_centers',getCenters);
router.get('/get_global_settings',globalSettings);

module.exports = router;