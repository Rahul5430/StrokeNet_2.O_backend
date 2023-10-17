const mongoose = require("mongoose");
const PatientSchema = new mongoose.Schema({
  first_name: { type: "string", required: true },
  last_name: { type: "string" },
  name: { type: "string" },
  date_of_birth: { type: "string", format: "date" },
  age: { type: "number" },
  gender: { type: "string" },
  weakness_side: { type: "string" },
  created_by: { type: "string" },
  contact_number: { type: "string" },
  address: { type: "string" },
  covid_score: { type: "number" },
  covid_values: {
    // Define the structure for COVID values
  },
  center_id: { type: "string" },
  datetime_of_stroke: { type: "string", format: "date-time" },
  datetime_of_stroke_timeends: { type: "string", format: "date-time" },
  last_updated: { type: "string", format: "date-time" },
  created: { type: "string", format: "date-time" },
  admission_time: { type: "string", format: "date-time" },
  datetime_of_stroke_fortyfive_deadline: {
    type: "string",
    format: "date-time",
  },
  patient_code: { type: "string" },
  isHubUser: { type: "boolean" },
  isSpokeUser: { type: "boolean" },
  isCenterUser: { type: "boolean" },
  transition_statuses: {
    type: "array",
    items: {
      type: "object",
      properties: {
        status_id: { type: "number" },
        user_id: { type: "string" },
        created: { type: "string", format: "date-time" },
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
        file_type: { type: "string" },
        scan_type: { type: "string" },
        file: { type: "string" },
        created: { type: "string", format: "date-time" },
      },
    },
  },
  window_period: { type: "string" },
  nihss_admission: { type: "string" },
  getPushIDs: {
    type: "object",
    properties: {
      pushIDs: {
        type: "array",
        items: { type: "string" },
      },
      mobileNumbers: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
});
