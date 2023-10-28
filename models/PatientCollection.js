const mongoose = require("mongoose");
const PatientSchema = new mongoose.Schema({
  first_name: { type: String, required: true },
  last_name: { type: String },
  name: { type: String },
  date_of_birth: { type: String, format: "date" },
  age: { type: Number },
  gender: { type: String },
  weakness_side: { type: String },
  contact_number: { type: String },
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
  //   patient_presentations: {
  //     // Define structure for patient presentations
  //   },
  //   patient_complications: {
  //     // Define structure for patient complications
  //   },
  //   patient_contradictions: {
  //     // Define structure for patient contradictions
  //   },
  //   patient_scan_times: {
  //     // Define structure for scan times
  //   },
  //   patient_ivt_medications: {
  //     // Define structure for IVT medications
  //   },
  //   patient_nihss: {
  //     // Define structure for NIHSS data
  //   },
  //   patient_mrs: {
  //     // Define structure for MRS data
  //   },
  total_scans: {
    type: Number,
    default: 0,
  },
  patient_files: {
    cta_ctp: [],
    mri: [],
    ncct: [],
    default: {
      cta_ctp: [],
      mri: [],
      ncct: [],
    },
    // items: {
    //   type: "object",
    //   properties: {
    //     file_type: { type: String },
    //     scan_type: { type: String },
    //     file: { type: String },
    //     created: { type: String, format: "date-time" },
    //   },
    // },
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
  covid_values: {
    type: String,
    default: "",
  },
  stroke_type: {
    type: String,
    default: "H",
  },
  show_stroke_type_text: {
    type: String,
    default: "Yes",
  },
  show_increment_timer: {
    type: Number,
    default: 1,
  },
  show_decrement_timer: {
    type: Number,
    default: 0,
  },
  show_original_name: {
    type: String,
    default: "Yes",
  },
  name: {
    type: String,
  },
  patient_code: {
    type: String,
  },
  admission_time: { type: String, format: "date-time" },
  datetime_of_stroke_fortyfive_deadline: {
    type: String,
    format: "date-time",
  },
  created_by: {
    type: String,
  },
  last_updated: {
    type: String,
    format: "date-time",
  },
  gender: {
    type: String,
  },
  age: {
    type: Number,
  },
  covid_score: {
    type: Number,
    default: 10,
  },
  show_tfso_total_time_message_box: {
    type: Number,
    default: 12,
  },
  datetime_of_stroke: { type: String, format: "date-time" },
  datetime_of_stroke_timeends: { type: String, format: "date-time" },
  created: { type: String, format: "date-time" },
  patient_basic_details: {
    first_name: {
      type: String,
    },
    last_name: {
      type: String,
    },
    gender: {
      type: String,
    },
    age: {
      type: Number,
    },
    date_of_birth: {
      type: String,
    },
    admission_time: {
      type: String,
      format: "date-time",
    },
    contact_number: {
      type: String,
    },
    body_weight: {
      type: Number,
    },
    blood_group: {
      type: String,
      default: "",
    },
    address: {
      type: String,
    },
    bp_x: {
      type: Number,
    },
    bp_y: {
      type: Number,
    },
    rbs: {
      type: String,
      default: "",
    },
    inr: {
      type: String,
      default: "",
    },
    aspects: {
      type: String,
      default: "",
    },
    is_wakeup_stroke: {
      type: Boolean,
      default: false,
    },
    is_hospital_stroke: {
      type: Boolean,
      default: false,
    },
    weakness_side: {
      type: String,
      default: "",
    },
    co_morbidities: {
      type: String,
      default: "",
    },
    similar_episodes_in_past: {
      type: String,
      default: "",
    },
    similar_episodes_in_past_text: {
      type: String,
    },
    inclusion_exclusion_assessed: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
    last_updated: {
      type: String,
      format: "date-time",
    },
  },
  patient_scan_times: {
    patient_id: {
      type: String,
    },
    type_of_stroke: {
      type: String,
    },
    ct_scan_time: {
      type: String,
      format: "date-time",
    },
    mr_scan_time: {
      type: String,
      format: "date-time",
    },
    mr_mra_time: {
      type: String,
      format: "date-time",
    },
    dsa_time_completed: {
      type: String,
      format: "date-time",
    },
    aspects: {
      type: String,
      default: "",
    },
    lvo: {
      type: Boolean,
      default: false,
    },
    lvo_types: {
      type: String,
      default: "",
    },
    lvo_site: {
      type: String,
      default: "",
    },
  },
  user_data: {},
  patient_complications: {
    bed_sore: {
      type: Boolean,
      default: false,
    },
    bed_sore_site: {
      type: String,
    },
    bed_sore_degree: {
      type: String,
    },
    bed_sore_duration: {
      type: String,
    },
    bed_sore_photo: {
      type: String,
    },
    bed_sore_photo_thumb: {
      type: String,
    },
    aspiration: {
      type: Boolean,
      default: false,
    },
    aspiration_duration: {
      type: String,
    },
    deep_vein_thrombosis: {
      type: Boolean,
      default: false,
    },
    deep_vein_thrombosis_site: {
      type: String,
    },
    deep_vein_thrombosis_duration: {
      type: String,
    },
    frozen_shoulder: {
      type: Boolean,
      default: false,
    },
    frozen_shoulder_site: {
      type: String,
    },
    frozen_shoulder_duration: {
      type: String,
    },
    contracture: {
      type: Boolean,
      default: false,
    },
    contracture_site: {
      type: String,
    },
    contracture_duration: {
      type: String,
    },
    spasticity: {
      type: Boolean,
      default: false,
    },
    spasticity_site: {
      type: String,
    },
    spasticity_duration: {
      type: String,
    },
    cauti: {
      type: Boolean,
      default: false,
    },
    cauti_duration: {
      type: String,
    },
    others: {
      type: Boolean,
      default: false,
    },
    others_information: {
      type: String,
    },
    others_duration: {
      type: String,
    },
    last_updated: {
      type: String,
      formate: "date-time",
    },
  },
  patient_contradictions: {
    show_ivtineligible_box: {
      type: Number,
      default: 0,
    },
    default: {},
  },
  showIVTProtocolBox: {
    type: Number,
    default: 1,
  },
  patient_nihss: {
    admission: {
      nihss_value: {
        type: Number,
      },
      nihss_options: {
        type: String,
        default: "",
      },
    },
    "24_hours": {
      nihss_value: {
        type: Number,
      },
      nihss_options: {
        type: String,
        default: "",
      },
    },
    discharge: {
      nihss_value: {
        type: Number,
      },
      nihss_options: {
        type: String,
        default: "",
      },
    },
  },
  patient_mrs: {
    discharge: {
      mrs_points: {
        type: Number,
      },
      mrs_options: {
        type: String,
        default: "",
      },
    },
    "1_month": {
      mrs_points: {
        type: Number,
      },
      mrs_options: {
        type: String,
        default: "",
      },
    },
    "3_months": {
      mrs_points: {
        type: Number,
      },
      mrs_options: {
        type: String,
        default: "",
      },
    },
  },
});

const Patient = mongoose.model("PatientCollection", PatientSchema);

module.exports = Patient;
