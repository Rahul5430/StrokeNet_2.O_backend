const mongoose = require('mongoose');

const PatientBasicDetailsSchema = new mongoose.Schema({
  admission_time_formatted: {
    type: Number,
    default: 0
  },
  body_weight: {
    type: Number,
    default: null
  },
  blood_group: {
    type: String,
    default: ""
  },
  bpx: {
    type: Number,
    default: 1
  },
  bpy: {
    type: Number,
    default: 2
  },
  rbs: {
    type: String,
    default: ""
  },
  inr: {
    type: String,
    default: ""
  },
  aspects: {
    type: String,
    default: ""
  },
  is_wakeup_stroke: {
    type: String,
    default: ""
  },
  is_hospital_stroke: {
    type: String,
    default: ""
  },
  weakness_side: {
    type: String,
    default: ""
  },
  co_morbidities: {
    type: String,
    default: ""
  },
  similar_episodes_in_past: {
    type: String,
    default: ""
  },
  inclusion_exclusion_assessed: {
    type: String,
    default: ""
  },
  notes: {
    type: String,
    default: ""
  },
});

const PatientBasicDetails = mongoose.model('PatientBasicDetailsCollection', PatientBasicDetailsSchema);

module.exports = PatientBasicDetails;
