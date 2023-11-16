const Patient = require("../models/PatientCollection");
const Centers = require("../models/CentersCollection");
const Page = require("../models/PageCollection");
const User = require("../models/UserCollection");
const { calculateAge, sendNotification } = require("./BaseController");
const fs = require("fs");
const path = require("path");

const addPatient = async (req, res) => {
  try {
    const headerUserId = req.headers.userid;
    const headerUserToken = req.headers.usertoken;

    // Validate user (you can implement your user validation logic here)
    if (headerUserId && headerUserToken) {
      const data = req.body;

      const errors = [];

      if (!data.name || data.name === "") {
        errors.push("Name is required");
      } else if (!data.datetime_of_stroke || data.datetime_of_stroke === "") {
        errors.push("Date/Time of Stroke is required");
      } else if (!data.weakness_side || data.weakness_side === "") {
        errors.push("Weakness side is required");
      }

      if (errors.length > 0) {
        return res.status(403).json({ data: { message: errors[0] } });
      } else {
        const patientData = data;
        patientData.patient_basic_details = {};

        if (data.first_name) {
          patientData.first_name = data.first_name;
          patientData.name = data.first_name;
        }

        if (data.last_name) {
          patientData.last_name = data.last_name;
          patientData.name = `${data.first_name} ${data.last_name}`;
        }

        if (data.name) {
          const explodeName = data.name.split(" ");

          if (explodeName[0]) {
            patientData.first_name = explodeName[0];
            patientData.patient_basic_details.first_name = explodeName[0];
          }

          if (explodeName[1]) {
            patientData.last_name = explodeName[1];
            patientData.patient_basic_details.last_name = explodeName[1];
          }

          patientData.name = data.name;
        }
        // if (data.date_of_birth) {
        //   patientData.date_of_birth = data.date_of_birth;
        //   patientData.age = calculateAge(data.date_of_birth);
        // }

        // if (data.age) {
        //   patientData.age = data.age;
        //   const today = new Date();
        //   const pastDate = new Date(
        //     today.getFullYear() - data.age,
        //     today.getMonth(),
        //     today.getDate()
        //   );
        //   patientData.date_of_birth = formatDate(pastDate);
        // }

        if (data.gender) {
          patientData.gender = data.gender;
          patientData.patient_basic_details.gender = data.gender;
        }

        if (data.weakness_side) {
          patientData.weakness_side = data.weakness_side;
          patientData.patient_basic_details.weakness_side = data.weakness_side;
        }

        const user = await User.findById(headerUserId);
        patientData.user_data = {
          user_id: user._id,
          fullname: user.fullname,
          phone_number: user.phone_number,
        };

        if (data.contact_number) {
          patientData.contact_number = data.contact_number;
          patientData.patient_basic_details.contact_number =
            data.contact_number;
        }

        if (data.address) {
          patientData.address = data.address;
          patientData.patient_basic_details.address = data.address;
        }

        if (data.covid_score) {
          patientData.covid_score = data.covid_score;
        }

        if (data.covid_values) {
          patientData.covid_values = data.covid_values;
        }

        patientData.last_updated = Date.now();
        patientData.created = Date.now();

        const center_id = user.center_id;
        patientData.center_id = center_id;

        // patientData.datetime_of_stroke = formatDate(data.datetime_of_stroke);

        // More data assignments...
        const savedPatient = await Patient.insertMany([patientData]);
        return res.status(200).json({ data: savedPatient[0] });
      }
    } else {
      return res.status(403).json({ data: { message: "INVALID_CREDENTIALS" } });
    }
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(500).json({ data: { message: "An error occurred" } });
  }
};

const getUserPatients = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;

  if (headerUserId && headerUserToken) {
    // const getUserCenterId = await User.findById(headerUserId);
    const getUser = await User.findById(headerUserId);
    // const getCenterInfo = await this.ci.db.get(
    //   "centers",
    //   ["id", "short_name", "is_hub", "main_hub"],
    //   { id: getUserCenterId.center_id }
    // );
    const getCenterInfo = getUser.center_id;
    // console.log(getCenterInfo);

    let mainHubId = "";
    if (getCenterInfo.main_hub && getCenterInfo.main_hub !== null) {
      mainHubId = getCenterInfo.main_hub;
    } else {
      mainHubId = getCenterInfo.id;
    }

    const patientTypes = {
      spoke_patients: [],
      hub_spoke_patients: [],
      hub_patients: [],
      centers: [],
    };

    let getSpokePatients;

    if (getCenterInfo.is_hub === "yes") {
      getSpokePatients = await Patient.find({ center_id: getCenterInfo });
      // getSpokePatients = await this.ci.db.select("user_patients", "*", {
      //   AND: [{ is_hub: "0" }, { in_transition: "0" }, { hub_id: mainHubId }],
      //   ORDER: { created: "DESC" },
      // });
    } else {
      getSpokePatients = await Patient.find({ center_id: getCenterInfo });
      // getSpokePatients = await this.ci.db.select("user_patients", "*", {
      //   AND: [{ center_id: getUserCenterId.center_id }, { hub_id: mainHubId }],
      //   ORDER: { created: "DESC" },
      // });
    }

    for (const val of getSpokePatients) {
      const patientDetails = {
        id: val._id,
        created_by: val.created_by,
        name: val.name,
        patient_code: val._id,
        age: val.age,
        gender: val.gender,
        last_updated: val.last_updated,
        created: val.created,
        show_original_name: true,
      };
      patientDetails.assets = { photos: 0, videos: 0 };
      Object.keys(val.patient_files).forEach((ele) => {
        val.patient_files[ele].forEach((file) => {
          if (file.file_type.includes("image")) {
            patientDetails.assets.photos += 1;
          } else patientDetails.assets.videos += 1;
        });
      });
      const getStrokeType = val.patient_scan_times;
      if (
        getStrokeType.type_of_stroke &&
        getStrokeType.type_of_stroke !== null
      ) {
        if (getStrokeType.type_of_stroke === "Hemorrhagic") {
          patientDetails.show_stroke_type_text = true;
          patientDetails.stroke_type = "H";
        } else {
          patientDetails.show_stroke_type_text = true;
          patientDetails.stroke_type = "I";
        }
      }
      // console.log(patientDetails);
      //     const patientDetails = await this.ci.db.get(
      //       "patients",
      //       [
      //         "id",
      //         "created_by",
      //         "name",
      //         "patient_code",
      //         "age",
      //         "gender",
      //         "last_updated",
      //         "created",
      //       ],
      //       { id: patientId }
      //     );
      //     patientDetails.created = new Date(
      //       patientDetails.created
      //     ).toLocaleString();
      // patientDetails.assets = {
      //   photos: 0,
      //   videos: 0,
      // };
      //     patientDetails.assets.photos = await this.ci.db.count("patient_files", {
      //       AND: [{ patient_id: patientId }, { file_type: "jpg" }],
      //     });
      //     patientDetails.assets.videos = await this.ci.db.count("patient_files", {
      //       AND: [{ patient_id: patientId }, { "file_type[!]": "jpg" }],
      //     });
      //     const getStrokeType = await this.ci.db.get(
      //       "patient_scan_times",
      //       ["type_of_stroke"],
      //       { patient_id: patientId }
      //     );
      //     if (
      //       getStrokeType.type_of_stroke &&
      //       getStrokeType.type_of_stroke !== null
      //     ) {
      //       if (getStrokeType.type_of_stroke === "Hemorrhagic") {
      //         patientDetails.show_stroke_type_text = true;
      //         patientDetails.stroke_type = "H";
      //       } else {
      //         patientDetails.show_stroke_type_text = true;
      //         patientDetails.stroke_type = "I";
      //       }
      //     } else {
      //       patientDetails.show_stroke_type_text = false;
      //     }
      //     patientDetails.patient_checked = patientCheckedbyUser(
      //       patientDetails.id,
      //       headerUserId[0],
      //       patientDetails.last_updated
      //     );
      //     patientDetails.is_center_patient = val.is_center === "1";
      //     patientDetails.is_spoke_patient = val.is_spoke === "1";
      //     patientDetails.is_hub_patient = val.is_hub === "1";
      //     patientDetails.in_transition = val.in_transition === "1";
      //     const getTheUserCenterId = await this.ci.db.get("users", ["center_id"], {
      //       user_id: headerUserId[0],
      //     });
      //     const getCenterInfo = await this.ci.db.get(
      //       "centers",
      //       ["id", "short_name", "is_hub"],
      //       { id: getTheUserCenterId.center_id }
      //     );
      //     patientDetails.is_user_from_hub = getCenterInfo.is_hub === "yes";
      //     if (patientDetails.is_user_from_hub) {
      //       if (
      //         patientDetails.is_hub_patient ||
      //         (patientDetails.in_transition && patientDetails.is_spoke_patient)
      //       ) {
      //         patientDetails.can_edit_patient_details = true;
      //         patientDetails.show_original_name = true;
      //       } else {
      //         patientDetails.can_edit_patient_details = false;
      //         patientDetails.show_original_name = false;
      //       }
      //     } else {
      //       if (patientDetails.is_spoke_patient && !patientDetails.in_transition) {
      //         patientDetails.can_edit_patient_details = true;
      //         patientDetails.show_original_name = true;
      //       } else if (
      //         patientDetails.is_center_patient &&
      //         !patientDetails.in_transition
      //       ) {
      //         patientDetails.can_edit_patient_details = true;
      //         patientDetails.show_original_name = true;
      //       } else {
      //         patientDetails.can_edit_patient_details = false;
      //         patientDetails.show_original_name = false;
      //       }
      //     }
      //     const patientCenter = await this.ci.db.get("centers", ["center_name"], {
      //       id: val.center_id,
      //     });
      //     patientDetails.center = patientCenter.center_name;
      //     patientDetails.calculated_times = getPatientCalculatedTimes(
      //       patientDetails.id
      //     );
      //     if (
      //       patientDetails.calculated_times.times &&
      //       patientDetails.calculated_times.times.door_to_needle_time !== null
      //     ) {
      //       patientDetails.show_ivt_icon = true;
      //     } else {
      //       patientDetails.show_ivt_icon = false;
      //     }
      //     if (
      //       patientDetails.calculated_times.times &&
      //       patientDetails.calculated_times.times.mt_started_time !== null
      //     ) {
      //       patientDetails.show_mt_icon = true;
      //     } else {
      //       patientDetails.show_mt_icon = false;
      //     }
      //     patientTypes.spoke_patients.push(patientDetails);
      //   }
      //   const getHubTransitionPatients = await this.ci.db.select(
      //     "user_patients",
      //     "*",
      //     {
      //       AND: [
      //         { hub_id: mainHubId },
      //         {
      //           OR: [{ in_transition: "1" }, { is_hub: "1" }],
      //         },
      //       ],
      //       ORDER: { created: "DESC" },
      //     }
      //   );
      //   for (const val of getHubTransitionPatients) {
      //     const patientId = val.patient_id;
      //     const patientDetails = await this.ci.db.get(
      //       "patients",
      //       [
      //         "id",
      //         "created_by",
      //         "name",
      //         "patient_code",
      //         "age",
      //         "gender",
      //         "last_updated",
      //         "created",
      //       ],
      //       { id: patientId }
      //     );
      //     patientDetails.created = new Date(
      //       patientDetails.created
      //     ).toLocaleString();
      //     patientDetails.assets = {
      //       photos: 0,
      //       videos: 0,
      //     };
      //     patientDetails.assets.photos = await this.ci.db.count("patient_files", {
      //       AND: [{ patient_id: patientId }, { file_type: "jpg" }],
      //     });
      //     patientDetails.assets.videos = await this.ci.db.count("patient_files", {
      //       AND: [{ patient_id: patientId }, { "file_type[!]": "jpg" }],
      //     });
      //     const getStrokeType = await this.ci.db.get(
      //       "patient_scan_times",
      //       ["type_of_stroke"],
      //       { patient_id: patientId }
      //     );
      //     if (
      //       getStrokeType.type_of_stroke &&
      //       getStrokeType.type_of_stroke !== null
      //     ) {
      //       if (getStrokeType.type_of_stroke === "Hemorrhagic") {
      //         patientDetails.show_stroke_type_text = true;
      //         patientDetails.stroke_type = "H";
      //       } else {
      //         patientDetails.show_stroke_type_text = true;
      //         patientDetails.stroke_type = "I";
      //       }
      //     } else {
      //       patientDetails.show_stroke_type_text = false;
      //     }
      //     patientDetails.patient_checked = patientCheckedbyUser(
      //       patientDetails.id,
      //       headerUserId[0],
      //       patientDetails.last_updated
      //     );
      //     patientDetails.is_spoke_patient = val.is_spoke === "1";
      //     patientDetails.is_hub_patient = val.is_hub === "1";
      //     patientDetails.is_center_patient = val.is_center === "1";
      //     patientDetails.in_transition = val.in_transition === "1";
      //     const getTheUserCenterId = await this.ci.db.get("users", ["center_id"], {
      //       user_id: headerUserId[0],
      //     });
      //     const getCenterInfo = await this.ci.db.get(
      //       "centers",
      //       ["id", "short_name", "is_hub"],
      //       { id: getTheUserCenterId.center_id }
      //     );
      //     patientDetails.is_user_from_hub = getCenterInfo.is_hub === "yes";
      //     if (patientDetails.is_user_from_hub) {
      //       if (
      //         patientDetails.is_hub_patient ||
      //         (patientDetails.in_transition &&
      //           (patientDetails.is_spoke_patient ||
      //             patientDetails.is_center_patient))
      //       ) {
      //         patientDetails.can_edit_patient_details = true;
      //         patientDetails.show_original_name = true;
      //       } else {
      //         patientDetails.can_edit_patient_details = false;
      //         patientDetails.show_original_name = false;
      //       }
      //     } else {
      //       if (patientDetails.is_spoke_patient && !patientDetails.in_transition) {
      //         patientDetails.can_edit_patient_details = true;
      //         patientDetails.show_original_name = true;
      //       } else if (
      //         patientDetails.is_center_patient &&
      //         !patientDetails.in_transition
      //       ) {
      //         patientDetails.can_edit_patient_details = true;
      //         patientDetails.show_original_name = true;
      //       } else {
      //         patientDetails.can_edit_patient_details = false;
      //         patientDetails.show_original_name = false;
      //       }
      //     }
      //     const patientCenter = await this.ci.db.get("centers", ["center_name"], {
      //       id: val.center_id,
      //     });
      //     patientDetails.center = patientCenter.center_name;
      //     patientDetails.calculated_times = getPatientCalculatedTimes(
      //       patientDetails.id
      //     );
      //     if (
      //       patientDetails.calculated_times.times &&
      //       patientDetails.calculated_times.times.door_to_needle_time !== null
      //     ) {
      //       patientDetails.show_ivt_icon = true;
      //     } else {
      //       patientDetails.show_ivt_icon = false;
      //     }
      //     if (
      //       patientDetails.calculated_times.times &&
      //       patientDetails.calculated_times.times.mt_started_time !== null
      //     ) {
      //       patientDetails.show_mt_icon = true;
      //     } else {
      //       patientDetails.show_mt_icon = false;
      //     }
      //     patientTypes.hub_patients.push(patientDetails);
      if (getCenterInfo.is_hub === "yes") {
        patientTypes.hub_patients.push(patientDetails);
      } else {
        patientTypes.spoke_patients.push(patientDetails);
      }
    }
    // patientTypes.centers = [];
    if (getCenterInfo.is_hub === "yes") {
      const spokes = await Centers.find({ main_hub: getCenterInfo.id });
      for (const spoke of spokes) {
        const patients = await Patient.find({ center_id: spoke });
        for (const val of patients) {
          const patientDetails = {
            id: val._id,
            created_by: val.created_by,
            name: val.name,
            patient_code: val._id,
            age: val.age,
            gender: val.gender,
            last_updated: val.last_updated,
            created: val.created,
            show_original_name: true,
            center: val.center_id.center_name,
          };
          patientDetails.assets = { photos: 0, videos: 0 };
          Object.keys(val.patient_files).forEach((ele) => {
            val.patient_files[ele].forEach((file) => {
              if (file.file_type.includes("image")) {
                patientDetails.assets.photos += 1;
              } else patientDetails.assets.videos += 1;
            });
          });
          const getStrokeType = val.patient_scan_times;
          if (
            getStrokeType.type_of_stroke &&
            getStrokeType.type_of_stroke !== null
          ) {
            if (getStrokeType.type_of_stroke === "Hemorrhagic") {
              patientDetails.show_stroke_type_text = true;
              patientDetails.stroke_type = "H";
            } else {
              patientDetails.show_stroke_type_text = true;
              patientDetails.stroke_type = "I";
            }
          }
          patientTypes.spoke_patients.push(patientDetails);
        }
      }
      const hubSpokePatients = {};
      for (const patient of patientTypes.spoke_patients) {
        hubSpokePatients[patient.center] = {
          name: patient.center,
          patients: [],
        };
      }
      for (const patient of patientTypes.spoke_patients) {
        hubSpokePatients[patient.center].patients.push(patient);
      }
      patientTypes.hub_spoke_patients = Object.values(hubSpokePatients);
      patientTypes.centers = Object.keys(hubSpokePatients);
    }
    const output = { data: patientTypes };
    return res.status(200).json(output);
  } else {
    const output = { date: { message: "INVALID_CREDENTIALS" } };
    return res.status(403).json(output);
  }
};

const getSinglePatient = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  const patientId = req.params.PatientId;

  if (headerUserId && headerUserToken && patientId != undefined) {
    try {
      const patientDetails = await getPatientDetails(patientId, headerUserId);
      if (patientDetails == null) {
        const output = { data: { message: "Patient Not Found" } };
        return res.status(403).json(output);
      }
      const output = { data: patientDetails };
      res.status(200).json(output);
    } catch (err) {
      console.log(err);
      const output = { data: { message: "Patient Not Found" } };
      res.status(403).json(output);
    }
  } else {
    const output = { data: { message: "INVALID_CREDENTIALS" } };
    res.status(403).json(output);
  }
};

// const patientCheckedbyUse = (patientId, userId, patient_last_updated) => {};

const getPatientDetails = async (patientID, userId) => {
  // Get the information of the patient
  let patient = await Patient.findById(patientID);
  if (!patient) {
    return null;
  }

  // patient.created = new Date(patient.created * 1000).toLocaleString();
  // patient.datetime_of_stroke_formatted = new Date(patient.datetime_of_stroke * 1000).toLocaleString();

  // patient.show_original_name="yes";
  // patient.admission_time_formatted="yes";

  // // Check if patient information checked already
  // patient.patient_checked = await this.patientCheckedbyUser(patient.id, userId, patient.last_updated);
  // patient.last_update = await this.ci.db.get("patient_updates", "*", { "patient_id": patientID }, { "ORDER": { "id": "DESC" } });
  // if (patient.last_update && patient.last_update.id) {
  //     patient.last_update.user_id = this.getUserDetailsBasic(patient.last_update.user_id);
  // }

  // patient.last_message = await this.getLastMessageFromPatientConversations(userId, patientID);

  // // Calculate Age of the patient
  // const today = new Date();
  // const dateOfBirth = new Date(patient.date_of_birth);
  // const ageDiff = Math.abs(today - dateOfBirth);
  // patient.age = Math.floor(ageDiff / (1000 * 60 * 60 * 24 * 365.25));

  // const datetimeStrokeStarts = new Date(patient.datetime_of_stroke).getTime();
  // const datetimeStrokeEnds = new Date(patient.datetime_of_stroke_timeends).getTime();
  // const currentTime = new Date().getTime();

  // if (currentTime > datetimeStrokeStarts) {
  //     patient.show_increment_timer = true;
  // }

  // const getPatientTransitionStatusesOfEntry = await this.ci.db.query("SELECT created, id, status_id, title FROM `transition_statuses_view` WHERE patient_id = " + patientID + " AND (status_id = 1 OR status_id = 2 OR status_id = 19) ORDER BY id DESC LIMIT 1");
  // for (let key in getPatientTransitionStatusesOfEntry) {
  //     if (typeof getPatientTransitionStatusesOfEntry[key] === "object") {
  //         delete getPatientTransitionStatusesOfEntry[key];
  //     }
  // }
  // if (getPatientTransitionStatusesOfEntry.length > 0) {
  //     const fortyfiveminsStart = new Date(getPatientTransitionStatusesOfEntry[0].created).getTime();
  //     const fortyfiveminsEnds = new Date(fortyfiveminsStart + 45 * 60 * 1000).toLocaleString();
  //     if (currentTime > fortyfiveminsStart && currentTime < new Date(fortyfiveminsEnds).getTime()) {
  //         patient.show_decrement_timer = true;
  //         patient.datetime_of_procedure_to_be_done = fortyfiveminsEnds;
  //     } else {
  //         patient.show_decrement_timer = false;
  //         patient.datetime_of_procedure_to_be_done = fortyfiveminsEnds;
  //     }
  // }

  // // Hide Decrement timer if TFSO is more than 4.5 hours
  // const checkTFSO = new Date(new Date(patient.datetime_of_stroke).getTime() + 4.5 * 60 * 60 * 1000).toLocaleString();
  // if (datetimeStrokeStarts > currentTime) {
  //     patient.show_decrement_timer = false;
  // }

  // // Stop all timers if any of the status is available: IVT and MT ineligible, or Clock is stopped
  // const getPatientTransitionStatusesOfEntryForStoppingClock = await this.ci.db.query("SELECT created, id, status_id, title FROM `transition_statuses_view` WHERE patient_id = " + patientID + " AND (status_id = 11 OR status_id = 16 OR status_id = 17 OR status_id = 23 OR status_id = 25) ORDER BY id DESC LIMIT 1");
  // for (let key in getPatientTransitionStatusesOfEntryForStoppingClock) {
  //     if (typeof getPatientTransitionStatusesOfEntryForStoppingClock[key] === "object") {
  //         delete getPatientTransitionStatusesOfEntryForStoppingClock[key];
  //     }
  // }

  // if (getPatientTransitionStatusesOfEntryForStoppingClock.length > 0) {
  //     const clockedStoppedat = new Date(getPatientTransitionStatusesOfEntryForStoppingClock[0].created);
  //     const dateA = new Date(patient.datetime_of_stroke);
  //     const dateB = new Date(clockedStoppedat);
  //     const interval = new Date(dateA - dateB);

  //     const dateArray = [];
  //     if (interval.getUTCDate() > 0) {
  //         dateArray.push(interval.getUTCDate() + "d");
  //     }
  //     if (interval.getUTCHours() > 0) {
  //         dateArray.push(interval.getUTCHours() + "h");
  //     }
  //     if (interval.getUTCMinutes() > 0) {
  //         dateArray.push(interval.getUTCMinutes() + "m");
  //     }
  //     if (interval.getUTCSeconds() > 0) {
  //         dateArray.push(interval.getUTCSeconds() + "s");
  //     }
  //     patient.show_increment_timer = false;
  //     patient.show_tfso_total_time_message_box = true;
  //     patient.show_total_time_taken_from_entry = dateArray.join(" : ");

  //     // Needle Time Clock
  //     const getPatientIVTTimes = this.ci.db.get("patient_ivt_times", "*", { "patient_id": patientID }, { "ORDER": { "id": "DESC" } });
  //     if (getPatientIVTTimes && getPatientIVTTimes.id) {
  //         patient.needle_time_at_stroke_entry = new Date(patient.datetime_of_stroke).getTime();
  //         patient.needle_time_total_time = new Date(getPatientIVTTimes.datetime_of_stroke + getPatientIVTTimes.time * 1000);
  //     } else {
  //         patient.needle_time_at_stroke_entry = null;
  //         patient.needle_time_total_time = null;
  //     }

  // } else {
  //     patient.show_tfso_total_time_message_box = false;
  // }

  // // nitin formatted date
  // patient.datetime_of_stroke = FormattedDate(patient.datetime_of_stroke);
  // patient.patient_basic_details.admission_time = FormattedDate(
  //   patient.patient_basic_details.admission_time
  // );
  // patient.patient_scan_times.ct_scan_time=FormattedDate(patient.patient_scan_times.ct_scan_time);
  // patient.patient_scan_times.mr_mra_time=FormattedDate(patient.patient_scan_times.mr_mra_time);
  // patient.patient_scan_times.mr_scan_time=FormattedDate(patient.patient_scan_times.mr_scan_time)
  return patient;
};

const updateBasicData = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;

  if ((headerUserId, headerUserToken)) {
    const data = req.body;
    // console.log(data);

    const errors = [];

    if (!data.patient_id || data.patient_id === "") {
      errors.push("patient_id is required");
    } else if (!data.first_name || data.first_name === "") {
      errors.push("First name is required");
    } else if (!data.weakness_side || data.weakness_side === "") {
      errors.push("Weakness side is required");
    }

    if (errors.length > 0) {
      const output = { data: { message: errors[0] } };
      return res.status(403).json(output);
    } else {
      const patientBasicData = {};

      const updatePatientBasicDetails = await Patient.findById(data.patient_id);

      if (data.first_name && data.first_name) {
        updatePatientBasicDetails.first_name = data.first_name;
        patientBasicData.first_name = data.first_name;
        patientBasicData.name = data.first_name;
        updatePatientBasicDetails.name = data.first_name;
      }
      if (data.last_name) {
        patientBasicData.last_name = data.last_name;
        updatePatientBasicDetails.last_name = data.last_name;
        patientBasicData.name = data.first_name + " " + data.last_name;
        updatePatientBasicDetails.name = data.first_name + " " + data.last_name;
      }

      patientBasicData.date_of_birth = data.date_of_birth;
      updatePatientBasicDetails.date_of_birth = data.date_of_birth;

      if (data.date_of_birth)
        patientBasicData.age = calculateAge(data.date_of_birth);
      updatePatientBasicDetails.age = patientBasicData.age;

      if (data.gender && data.gender) {
        patientBasicData.gender = data.gender;
        updatePatientBasicDetails.gender = data.gender;
      }
      if (data.contact_number && data.contact_number) {
        patientBasicData.contact_number = data.contact_number;
      }
      if (data.address && data.address) {
        patientBasicData.address = data.address;
      }
      if (data.handedness && data.handedness) {
        patientBasicData.handedness = data.handedness;
      }

      // console.log(data.is_wakeup_stroke);
      if (data.is_wakeup_stroke && data.is_wakeup_stroke) {
        patientBasicData.is_wakeup_stroke = data.is_wakeup_stroke;
      }

      if (data.is_hospital_stroke && data.is_hospital_stroke) {
        patientBasicData.is_hospital_stroke = data.is_hospital_stroke;
      }

      if (data.notes && data.notes) {
        patientBasicData.notes = data.notes;
      }

      if (data.weakness_side && data.weakness_side) {
        patientBasicData.weakness_side = data.weakness_side;
      }

      if (data.facial_deviation && data.facial_deviation) {
        patientBasicData.facial_deviation = data.facial_deviation;
      }

      if (data.co_morbidities && data.co_morbidities) {
        patientBasicData.co_morbidities = data.co_morbidities;
      }
      if (data.similar_episodes_in_past && data.similar_episodes_in_past) {
        patientBasicData.similar_episodes_in_past =
          data.similar_episodes_in_past;
      }

      if (
        data.similar_episodes_in_past_text &&
        data.similar_episodes_in_past_text
      ) {
        patientBasicData.similar_episodes_in_past_text =
          data.similar_episodes_in_past_text;
      }

      if (
        data.inclusion_exclusion_assessed &&
        data.inclusion_exclusion_assessed
      ) {
        patientBasicData.inclusion_exclusion_assessed =
          data.inclusion_exclusion_assessed;
      }

      if (data.bp_x && data.bp_x) {
        patientBasicData.bp_x = data.bp_x;
      }
      if (data.bp_y && data.bp_y) {
        patientBasicData.bp_y = data.bp_y;
      }
      if (data.rbs && data.rbs) {
        patientBasicData.rbs = data.rbs;
      }
      if (data.inr && data.inr) {
        patientBasicData.inr = data.inr;
      }
      if (data.aspects && data.aspects) {
        patientBasicData.aspects = data.aspects;
      }
      if (data.body_weight && data.body_weight) {
        patientBasicData.body_weight = data.body_weight;
      }
      if (data.blood_group && data.blood_group) {
        patientBasicData.blood_group = data.blood_group;
      }

      if (data.admission_time && data.admission_time) {
        patientBasicData.admission_time = data.admission_time;
      }

      patientBasicData.last_updated = new Date().toISOString();

      updatePatientBasicDetails.patient_basic_details = patientBasicData;

      updatePatientBasicDetails.last_updated = Date.now();

      await updatePatientBasicDetails.save();

      // ci.db.update("user_patients", { last_updated: new Date().toISOString() }, { patient_id: data.patient_id });

      // const updateData = {
      //     user_id: headerUserId[0],
      //     patient_id: data.patient_id,
      //     update_type: "basic_details",
      //     url: `snetchd://strokenetchandigarh.com/patient_detail/${data.patient_id}`,
      //     last_updated: new Date().toISOString(),
      // };

      // updatePatientStatus(updateData);

      const output = {
        data: "Basic Details updates successfully.",
      };
      return res.status(200).json(output);
    }
  } else {
    const output = { data: { message: "INVALID_CREDENTIALS" } };
    return res.status(403).json(output);
  }
};

const updateScanTimesofPatient = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if ((headerUserId, headerUserToken)) {
    try {
      const data = req.body;
      const errors = [];

      if (!data.patient_id || data.patient_id === "") {
        errors.push("patient_id is required");
      } else if (!data.ct_scan_time || data.ct_scan_time === "") {
        errors.push("CT/CTA Time is required");
      } else if (!data.type_of_stroke || data.type_of_stroke === "") {
        errors.push("Type of Stroke is required");
      }

      if (errors.length > 0) {
        const output = { data: { message: errors[0] } };
        return res.status(403).json(output);
      } else {
        const patientScanTimes = {};

        if (data.ct_scan_time && data.ct_scan_time) {
          patientScanTimes.ct_scan_time = data.ct_scan_time;
        }
        if (data.mr_mra_time && data.mr_mra_time) {
          patientScanTimes.mr_mra_time = data.mr_mra_time;
        }
        if (data.dsa_time_completed && data.dsa_time_completed) {
          patientScanTimes.dsa_time_completed = data.dsa_time_completed;
        }
        if (data.type_of_stroke && data.type_of_stroke) {
          patientScanTimes.type_of_stroke = data.type_of_stroke;
        }

        if (data.lvo) {
          patientScanTimes.lvo = data.lvo;
        }
        if (data.lvo_types && data.lvo_types) {
          patientScanTimes.lvo_types = data.lvo_types;
        }
        if (data.lvo_site && data.lvo_site) {
          patientScanTimes.lvo_site = data.lvo_site;
        }
        if (data.aspects) {
          patientScanTimes.aspects = data.aspects;
        }

        patientScanTimes.last_updated = new Date().toISOString();

        const updatePatientScanTimes = await Patient.findById(data.patient_id);
        updatePatientScanTimes.patient_scan_times = patientScanTimes;

        updatePatientScanTimes.last_updated = Date.now();

        await updatePatientScanTimes.save();

        // Update last_updated field in Patients collection
        // const updatePatients = await db.collection('patienjts').updateOne(
        //     { id: data.patient_id },
        //     {
        //         $set: {
        //             scans_needed: "0",
        //             scans_completed: "1",
        //             last_updated: new Date().toISOString()
        //         }
        //     }
        // );

        // If aspects exist, update them in the Patients collection
        // if (data.aspects) {
        //     const updateAspects = await db.collection('patients').updateOne(
        //         { id: data.patient_id },
        //         {
        //             $set: {
        //                 aspects: patientScanTimes.aspects,
        //                 last_updated: new Date().toISOString()
        //             }
        //         }
        //     );
        // }

        // Update last_updated field in user_patients collection
        // const updateUserPatients = await db.collection('user_patients').updateOne(
        //     { patient_id: data.patient_id },
        //     { $set: { last_updated: new Date().toISOString() } }
        // );

        // Global Status
        // const updateData = {
        //     user_id: headerUserId[0],
        //     patient_id: data.patient_id,
        //     update_type: "scan_details",
        //     url: `snetchd://strokenetchandigarh.com/patient_detail/${data.patient_id}`,
        //     last_updated: new Date().toISOString()
        // };
        // await updatePatientStatus(updateData);
        // Global Status

        const output = {
          data: { message: "Scan times updated successfully." },
        };
        return res.status(200).json(output);
      }
    } catch (err) {
      console.log(err);
      const output = { data: { message: "Something Went Wrong" } };
      return res.status(403).json(output);
    }
  } else {
    const output = { data: { message: "INVALID_CREDENTIALS" } };
    return res.status(403).json(output);
  }
};

const updatePatientComplications = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if ((headerUserId, headerUserToken)) {
    const data = req.body;
    // console.log(req.body);
    const errors = [];

    if (!data.patient_id || data.patient_id === "") {
      errors.push("patient_id is required");
    }

    if (errors.length > 0) {
      const output = { data: { message: errors[0] } };
      return res.status(403).json(output);
    } else {
      const patientComplications = {};

      if (data.bed_sore && data.bed_sore) {
        patientComplications.bed_sore = data.bed_sore;
      }
      if (data.bed_sore_site && data.bed_sore_site) {
        patientComplications.bed_sore_site = data.bed_sore_site;
      }
      if (data.bed_sore_degree && data.bed_sore_degree) {
        patientComplications.bed_sore_degree = data.bed_sore_degree;
      }
      if (data.bed_sore_duration && data.bed_sore_duration) {
        patientComplications.bed_sore_duration = data.bed_sore_duration;
      }
      if (data.bed_sore_photo && data.bed_sore_photo) {
        patientComplications.bed_sore_photo = data.bed_sore_photo;
      }

      if (data.aspiration && data.aspiration) {
        patientComplications.aspiration = data.aspiration;
      }
      if (data.aspiration_duration && data.aspiration_duration) {
        patientComplications.aspiration_duration = data.aspiration_duration;
      }

      if (data.deep_vein_thrombosis && data.deep_vein_thrombosis) {
        patientComplications.deep_vein_thrombosis = data.deep_vein_thrombosis;
      }
      if (data.deep_vein_thrombosis_site && data.deep_vein_thrombosis_site) {
        patientComplications.deep_vein_thrombosis_site =
          data.deep_vein_thrombosis_site;
      }
      if (
        data.deep_vein_thrombosis_duration &&
        data.deep_vein_thrombosis_duration
      ) {
        patientComplications.deep_vein_thrombosis_duration =
          data.deep_vein_thrombosis_duration;
      }

      if (data.frozen_shoulder && data.frozen_shoulder) {
        patientComplications.frozen_shoulder = data.frozen_shoulder;
      }
      if (data.frozen_shoulder_site && data.frozen_shoulder_site) {
        patientComplications.frozen_shoulder_site = data.frozen_shoulder_site;
      }
      if (data.frozen_shoulder_duration && data.frozen_shoulder_duration) {
        patientComplications.frozen_shoulder_duration =
          data.frozen_shoulder_duration;
      }

      if (data.contracture && data.contracture) {
        patientComplications.contracture = data.contracture;
      }
      if (data.contracture_site && data.contracture_site) {
        patientComplications.contracture_site = data.contracture_site;
      }
      if (data.contracture_duration && data.contracture_duration) {
        patientComplications.contracture_duration = data.contracture_duration;
      }

      if (data.spasticity && data.spasticity) {
        patientComplications.spasticity = data.spasticity;
      }
      if (data.spasticity_site && data.spasticity_site) {
        patientComplications.spasticity_site = data.spasticity_site;
      }
      if (data.spasticity_duration && data.spasticity_duration) {
        patientComplications.spasticity_duration = data.spasticity_duration;
      }

      if (data.cauti && data.cauti) {
        patientComplications.cauti = data.cauti;
      }
      if (data.cauti_duration && data.cauti_duration) {
        patientComplications.cauti_duration = data.cauti_duration;
      }

      if (data.others && data.others) {
        patientComplications.others = data.others;
      }
      if (data.others_information && data.others_information) {
        patientComplications.others_information = data.others_information;
      }
      if (data.others_duration && data.others_duration) {
        patientComplications.others_duration = data.others_duration;
      }

      patientComplications.last_updated = new Date().toISOString();

      const updatedPatientcomplications = await Patient.findById(
        data.patient_id
      );
      // console.log(updatedPatientcomplications);
      updatedPatientcomplications.patient_complications = patientComplications;

      updatedPatientcomplications.last_updated = Date.now();

      await updatedPatientcomplications.save();

      // await db
      //   .collection("patients")
      //   .updateOne(
      //     { id: data.patient_id },
      //     { $set: { last_updated: new Date().toISOString() } }
      //   );

      // await db
      //   .collection("user_patients")
      //   .updateOne(
      //     { patient_id: data.patient_id },
      //     { $set: { last_updated: new Date().toISOString() } }
      //   );

      // const updateData = {
      //   user_id: headerUserId[0],
      //   patient_id: data.patient_id,
      //   update_type: "complications",
      //   url: `snetchd://strokenetchandigarh.com/patient_detail/${data.patient_id}`,
      //   last_updated: new Date().toISOString(),
      // };
      // await updatePatientStatus(updateData);

      const output = {
        data: "Complications updated successfully.",
      };
      return res.status(200).json(output);
    }
  } else {
    const output = { data: { message: "INVALID_CREDENTIALS" } };
    return res.status(403).json(output);
  }
};

const updateNIHSSofPatient = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if ((headerUserId, headerUserToken)) {
    const data = req.body;
    // console.log(data);
    const errors = [];
    if (!data.patient_id) errors.push("patient_id is required");
    else if (!data.nihss_time) errors.push("nihss_time is required");
    else if (!data.nihss_value) errors.push("nihss_value is required");

    if (errors.length > 0) {
      return res.status(403).json({ message: errors[0] });
    } else {
      const patientNIHSS = {
        nihss_time: data.nihss_time,
        nihss_value: data.nihss_value,
      };

      if (data.nihss_options) {
        patientNIHSS.nihss_options = data.nihss_options;
      }

      const updatedNihssPatient = await Patient.findById(data.patient_id);
      updatedNihssPatient.patient_nihss[patientNIHSS.nihss_time].nihss_value =
        patientNIHSS.nihss_value;
      updatedNihssPatient.patient_nihss[patientNIHSS.nihss_time].nihss_options =
        patientNIHSS.nihss_options;

      updatedNihssPatient.last_updated = Date.now();

      await updatedNihssPatient.save();

      const output = {
        data: {
          message: "NIHSS was updated successfully",
          nihss_data: patientNIHSS,
        },
      };

      res.status(200).json(output);
    }
  } else {
    return res.status(403).json({ message: "INVALID_CREDENTIALS" });
  }
};

const updateMRSofPatient = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if ((headerUserId, headerUserToken)) {
    const data = req.body;
    const errors = [];
    if (!data.patient_id || data.patient_id === "") {
      errors.push("patient_id is required");
    } else if (!data.mrs_time || data.mrs_time === "") {
      errors.push("mrs_time is required");
    } else if (!data.mrs_options || data.mrs_options === "") {
      errors.push("mrs_options is required");
    } else if (data.mrs_points === "") {
      errors.push("mrs_points is required");
    }

    if (errors.length > 0) {
      const output = { data: { message: errors[0] } };
      return res.status(403).json(output);
    } else {
      const patientMRS = {
        mrs_time: data.mrs_time,
        mrs_options: data.mrs_options,
        mrs_points: data.mrs_points,
      };

      const updatedMRSPatient = await Patient.findById(data.patient_id);
      updatedMRSPatient.patient_mrs[data.mrs_time].mrs_options =
        patientMRS.mrs_options;
      updatedMRSPatient.patient_mrs[data.mrs_time].mrs_points =
        patientMRS.mrs_points;

      updatedMRSPatient.last_updated = Date.now();
      await updatedMRSPatient.save();

      // Update last_updated field in Patients table
      // db.update('patients', { last_updated: new Date().toISOString() }, { id: data.patient_id });
      // db.update('user_patients', { last_updated: new Date().toISOString() }, { patient_id: data.patient_id });

      // const patientMRSData = db.select('patient_mrs', ['mrs_time', 'mrs_options'], { patient_id: data.patient_id });
      const mrsData = updatedMRSPatient.patient_mrs;
      // patientMRSData.forEach((val) => {
      //   mrsData[val.mrs_time] = val;
      // });

      // // Global Status
      // const updateData = {
      //   user_id: headerUserId,
      //   patient_id: data.patient_id,
      //   update_type: 'mrs',
      //   url: `snetchd://strokenetchandigarh.com/patient_detail/${data.patient_id}`,
      //   last_updated: new Date().toISOString(),
      // };
      // updatePatientStatus(updateData);
      // // Global Status

      const output = {
        data: { message: "MRS was updated successfully", mrs_data: mrsData },
      };
      return res.status(200).json(output);
    }
  } else {
    const output = { data: { message: "INVALID_CREDENTIALS" } };
    return res.status(403).json(output);
  }
};

const scansUploadedAlertToTeam = async (req, res) => {
  const output = { data: { message: "file_uploaded" } };
  res.status(200).json(output);
};

const addPatientScanFile = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if ((headerUserId, headerUserToken)) {
    try {
      const user = await User.findById(headerUserId);
      const filedata = req.body;
      const patientFile = await Patient.findById(filedata.patient_id);
      const dataForDB = {
        file_type: filedata.file_type,
        file: filedata.file,
        user_role: user.user_role,
        created: Date.now(),
      };
      patientFile.patient_files[filedata.scan_type].push(dataForDB);
      patientFile.total_scans = patientFile.total_scans + 1;
      patientFile.last_updated = Date.now();
      await patientFile.save();
      const output = { data: { file: dataForDB, message: "file_uploaded" } };
      res.status(200).json(output);
    } catch (err) {
      console.log(err);
      const output = { data: { message: "Something Went Wrong" } };
      res.status(403).json(output);
    }
  }
};

const deletePatientFile = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if ((headerUserId, headerUserToken)) {
    const data = req.body;
    const errors = [];
    if (!data.file_id) {
      errors.push("file_id is required");
    } else if (!data.patient_id) {
      errors.push("Patient Id is invalid");
    } else if (!data.scan_type) {
      errors.push("Scan type is required");
    }
    if (errors.length > 0) {
      const output = { data: { message: errors[0] } };
      res.status(403).json(output);
    } else {
      const filePath = path.join(__dirname, "../public/files/") + data.file_id;
      // console.log(path.join(__dirname, "../public/files/"));
      const patient = await Patient.findById(data.patient_id);
      if (!patient) {
        const output = { data: { message: "Patient Not Valid" } };
        res.status(403).json(output);
        return;
      }
      fs.unlink(filePath, async (err) => {
        if (err) {
          const output = { data: { message: "No such file exists" } };
          res.status(403).json(output);
        } else {
          try {
            const patientScanTypeFile = patient.patient_files[data.scan_type];
            patient.patient_files[data.scan_type] = patientScanTypeFile.filter(
              (item) => item.file !== data.file_id
            );
            patient.total_scans = patient.total_scans - 1;
            patient.last_updated = Date.now();
            await patient.save();
            const output = { data: { message: "file_deleted" } };
            res.status(200).json(output);
          } catch (err) {
            console.log(err);
            const output = { data: { message: "Something Went Wrong" } };
            res.status(403).json(output);
          }
        }
      });
    }
  } else {
    const output = { data: { message: "INVALID_CREDENTIALS" } };
    res.status(403).json(output);
  }
};

const codeStrokeAlert = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if ((headerUserId, headerUserToken)) {
    const data=req.body;
    console.log(data);
    const errors = [];
    if(!data.patient_id){
      errors.push("Patient Id is Not Valid");
    }
    if (errors.length > 0) {
      const output = { data: { message: errors[0] } };
      return res.json(output, 403);
    } else {
      const getUserCenterId = await User.findById(headerUserId);
      const getCenterInfo = getUserCenterId.center_id;

      if (getCenterInfo.is_hub == "yes") {
        const Users = await User.find({ center_id: getCenterInfo });
        Users.forEach((user) => {
          if (user.fcm_userid != "") {
            sendNotification(user.fcm_userid, "codeStrokeAlert", {
              getCenterInfo: getCenterInfo,
              getUserCenterId: getUserCenterId,
              patientId:data.patient_id
            });
          }
        });
      } else {
        const Users = await User.find({ center_id: getCenterInfo });
        Users.forEach((user) => {
          if (user.fcm_userid != "") {
            sendNotification(user.fcm_userid, "codeStrokeAlert", {
              getCenterInfo: getCenterInfo,
              getUserCenterId: getUserCenterId,
              patientId:data.patient_id
            });
          }
        });
      }

      const output = { data: { message: "Code Stroke Sent!" } };
      return res.status(200).json(output);

      //   const getUserCenterId = this.ci.db.get(
      //     "users",
      //     ["center_id", "fullname", "user_role"],
      //     { user_id: headerUserId[0] }
      //   );
      //   const getCenterInfo = this.ci.db.get(
      //     "centers",
      //     ["id", "center_name", "is_hub", "main_hub"],
      //     { id: getUserCenterId.center_id }
      //   );

      //   const getHub = this.ci.db.get(
      //     "centers",
      //     ["id", "center_name", "short_name", "center_location", "is_hub"],
      //     { id: getCenterInfo.main_hub }
      //   );

      //   const getPushIDs = [];
      //   const getPhoneNumbers = [];

      //   let locationType;

      //   if (getCenterInfo.is_hub === "yes") {
      //     locationType = "Hub";

      //     const getAllUsersOneSignalFromHub = this.ci.db.select(
      //       "users",
      //       ["onesignal_userid", "phone_number"],
      //       { center_id: getCenterInfo.id }
      //     );

      //     getAllUsersOneSignalFromHub.forEach((user) => {
      //       getPushIDs.push(user.onesignal_userid);
      //       getPhoneNumbers.push("+91" + user.phone_number);
      //     });
      //   } else {
      //     locationType = "Spoke";

      //     const getAllUsersOneSignalFromHub = this.ci.db.select(
      //       "users",
      //       ["onesignal_userid", "phone_number"],
      //       { center_id: getCenterInfo.main_hub }
      //     );

      //     getAllUsersOneSignalFromHub.forEach((user) => {
      //       getPushIDs.push(user.onesignal_userid);
      //       getPhoneNumbers.push("+91" + user.phone_number);
      //     });

      //     const getAllUsersOneSignalFromSpoke = this.ci.db.select(
      //       "users",
      //       ["onesignal_userid", "phone_number"],
      //       { center_id: getUserCenterId.center_id }
      //     );

      //     getAllUsersOneSignalFromSpoke.forEach((user) => {
      //       getPushIDs.push(user.onesignal_userid);
      //       getPhoneNumbers.push("+91" + user.phone_number);
      //     });
      //   }

      //   // Create Push Data & Send Push
      //   const pushData = {
      //     title: "Code Stroke",
      //     message: `Acute Stroke in ${getCenterInfo.center_name} (${getUserCenterId.user_role})`,
      //     url: `snetchd://strokenetchandigarh.com/patient_detail/${data.patient_id}`,
      //     devices: getPushIDs,
      //   };

      //   codeStrokeSendPush(pushData);

      // Send SMS (Code for sending SMS is commented out)
      /*
      const smsData = {
          to: getPhoneNumbers.join("<"),
          message: `Acute Stroke in ${getCenterInfo.center_name} (${getUserCenterId.user_role}) snetchd://strokenetchandigarh.com/patient_detail/${data.patient_id}`,
      };
      sendSMS(smsData);
      */

      // Code for creating calls is also commented out
      /*
      getPhoneNumbers.forEach((number) => {
          const callData = {
              to: number,
          };
          createCall(callData);
      });
      */
    }
  } else {
    const output = { data: { message: "INVALID_CREDENTIALS" } };
    return res.status(403).json(output);
  }
};

const getHubSpokeCenters = async (req, res, args) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if ((headerUserId, headerUserToken)) {
    const patientId = args.patientId;

    // Get the current hospital of the patient
    const getPatientCenter = await this.ci.db
      .collection("patients")
      .findOne({ id: patientId }, { center_id: 1, id: 1 });

    if (getPatientCenter && getPatientCenter.id) {
      // Get the main hub from the center
      const getHubIdFromCenter = await this.ci.db
        .collection("centers")
        .findOne({ id: getPatientCenter.center_id }, { main_hub: 1, id: 1 });

      if (getHubIdFromCenter && getHubIdFromCenter.id) {
        if (getHubIdFromCenter.main_hub !== null) {
          // Get the list of all spoke centers where the hub is found
          const getAllSpokesFromHub = await this.ci.db
            .collection("centers")
            .find({
              main_hub: getHubIdFromCenter.main_hub,
              is_spoke: "yes",
            })
            .toArray();

          // Get Hub as well
          getAllSpokesFromHub.push(
            await this.ci.db
              .collection("centers")
              .findOne({ id: getHubIdFromCenter.main_hub })
          );

          const output = printData("success", getAllSpokesFromHub);
          return res.json(output);
        } else {
          const output = printData("error", {
            message: "Center doesn't have a main hub.",
          });
          return res.status(403).json(output);
        }
      } else {
        const output = printData("error", { message: "No such center found" });
        return res.status(404).json(output);
      }
    } else {
      const output = printData("error", { message: "No such patient found" });
      return res.status(404).json(output);
    }
  } else {
    const output = printData("error", { message: "INVALID_CREDENTIALS" });
    return res.status(403).json(output);
  }
};

module.exports = {
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
  getHubSpokeCenters,
};
