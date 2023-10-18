const mongoose = require("mongoose");
const PatientSchema = new mongoose.Schema({
  first_name: { type: String, required: true },
  last_name: { type: String },
  name: { type: String },
  date_of_birth: { type: String, format: "date" },
  age: { type: Number },
  gender: { type: String },
  weakness_side: { type: String },
  created_by: { type: String },
  contact_number: { type: String },
  address: { type: String },
  covid_score: { type: Number },
  covid_values: {
    // Define the structure for COVID values
  },
  center_id: { type: String },
  datetime_of_stroke: { type: String, format: "date-time" },
  datetime_of_stroke_timeends: { type: String, format: "date-time" },
  last_updated: { type: String, format: "date-time" },
  created: { type: String, format: "date-time" },
  admission_time: { type: String, format: "date-time" },
  datetime_of_stroke_fortyfive_deadline: {
    type: String,
    format: "date-time",
  },
  patient_code: { type: String },
  isHubUser: { type: "boolean" },
  isSpokeUser: { type: "boolean" },
  isCenterUser: { type: "boolean" },
  transition_statuses: {
    type: "array",
    items: {
      type: "object",
      properties: {
        status_id: { type: Number },
        user_id: { type: String },
        created: { type: String, format: "date-time" },
      },
    },
  },
  patient_presentations: {
    // Define structure for patient presentations
  },
  patient_complications: {
    // Define structure for patient complications
  },
  patient_contradictions: {
    // Define structure for patient contradictions
  },
  patient_scan_times: {
    // Define structure for scan times
  },
  patient_ivt_medications: {
    // Define structure for IVT medications
  },
  patient_nihss: {
    // Define structure for NIHSS data
  },
  patient_mrs: {
    // Define structure for MRS data
  },
  patient_files: {
    type: "array",
    items: {
      type: "object",
      properties: {
        file_type: { type: String },
        scan_type: { type: String },
        file: { type: String },
        created: { type: String, format: "date-time" },
      },
    },
  },
  window_period: { type: String },
  nihss_admission: { type: String },
  getPushIDs: {
    type: "object",
    properties: {
      pushIDs: {
        type: "array",
        items: { type: String },
      },
      mobileNumbers: {
        type: "array",
        items: { type: String },
      },
    },
  },
});

const Patient = mongoose.model('PateintCollection',PatientSchema);

module.exports = Patient;