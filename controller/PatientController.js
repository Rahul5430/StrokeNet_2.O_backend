const Patient = require("../models/PatientCollection");

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
        return res.status(403).json({data:{ message: errors[0] }});
      } else {
        const patientData = {};

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
          }

          if (explodeName[1]) {
            patientData.last_name = explodeName[1];
          }

          patientData.name = data.name;
        }
        if (data.date_of_birth) {
          patientData.date_of_birth = data.date_of_birth;
          patientData.age = calculateAge(data.date_of_birth);
        }

        if (data.age) {
          patientData.age = data.age;
          const today = new Date();
          const pastDate = new Date(
            today.getFullYear() - data.age,
            today.getMonth(),
            today.getDate()
          );
          // patientData.date_of_birth = formatDate(pastDate);
        }

        if (data.gender) {
          patientData.gender = data.gender;
        }

        if (data.weakness_side) {
          patientData.weakness_side = data.weakness_side;
        }

        patientData.created_by = headerUserId;

        if (data.contact_number) {
          patientData.contact_number = data.contact_number;
        }

        if (data.address) {
          patientData.address = data.address;
        }

        if (data.covid_score) {
          patientData.covid_score = data.covid_score;
        }

        if (data.covid_values) {
          patientData.covid_values = data.covid_values;
        }

        const center_id = "your_logic_to_retrieve_center_id";
        patientData.center_id = center_id;

        // patientData.datetime_of_stroke = formatDate(data.datetime_of_stroke);

        // More data assignments...
        const savedPatient = await Patient.insertMany([patientData]);
        return res.status(200).json({data:savedPatient[0]});
      }
    } else {
      return res.status(403).json({data:{ message: "INVALID_CREDENTIALS" }});
    }
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(500).json({data:{ message: "An error occurred" }});
  }
};

const getUserPatients = async (request, response) => {
  const headerUserId = request.getHeader("userId");
  const headerUserToken = request.getHeader("userToken");

  if (await validateUser(headerUserId[0], headerUserToken[0])) {
    const getUserCenterId = await this.ci.db.get("users", ["center_id"], {
      user_id: headerUserId[0],
    });
    const getCenterInfo = await this.ci.db.get(
      "centers",
      ["id", "short_name", "is_hub", "main_hub"],
      { id: getUserCenterId.center_id }
    );

    let mainHubId = 0;
    if (getCenterInfo.main_hub && getCenterInfo.main_hub !== null) {
      mainHubId = getCenterInfo.main_hub;
    } else {
      mainHubId = getCenterInfo.id;
    }

    const patientTypes = {
      spoke_patients: [],
      hub_spoke_patients: [],
      hub_patients: [],
    };

    let getSpokePatients;

    if (getCenterInfo.is_hub === "yes") {
      getSpokePatients = await this.ci.db.select("user_patients", "*", {
        AND: [{ is_hub: "0" }, { in_transition: "0" }, { hub_id: mainHubId }],
        ORDER: { created: "DESC" },
      });
    } else {
      getSpokePatients = await this.ci.db.select("user_patients", "*", {
        AND: [{ center_id: getUserCenterId.center_id }, { hub_id: mainHubId }],
        ORDER: { created: "DESC" },
      });
    }

    for (const val of getSpokePatients) {
      const patientId = val.patient_id;
      const patientDetails = await this.ci.db.get(
        "patients",
        [
          "id",
          "created_by",
          "name",
          "patient_code",
          "age",
          "gender",
          "last_updated",
          "created",
        ],
        { id: patientId }
      );
      patientDetails.created = new Date(
        patientDetails.created
      ).toLocaleString();

      patientDetails.assets = {
        photos: 0,
        videos: 0,
      };

      patientDetails.assets.photos = await this.ci.db.count("patient_files", {
        AND: [{ patient_id: patientId }, { file_type: "jpg" }],
      });

      patientDetails.assets.videos = await this.ci.db.count("patient_files", {
        AND: [{ patient_id: patientId }, { "file_type[!]": "jpg" }],
      });

      const getStrokeType = await this.ci.db.get(
        "patient_scan_times",
        ["type_of_stroke"],
        { patient_id: patientId }
      );
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
      } else {
        patientDetails.show_stroke_type_text = false;
      }

      patientDetails.patient_checked = patientCheckedbyUser(
        patientDetails.id,
        headerUserId[0],
        patientDetails.last_updated
      );

      patientDetails.is_center_patient = val.is_center === "1";
      patientDetails.is_spoke_patient = val.is_spoke === "1";
      patientDetails.is_hub_patient = val.is_hub === "1";
      patientDetails.in_transition = val.in_transition === "1";

      const getTheUserCenterId = await this.ci.db.get("users", ["center_id"], {
        user_id: headerUserId[0],
      });
      const getCenterInfo = await this.ci.db.get(
        "centers",
        ["id", "short_name", "is_hub"],
        { id: getTheUserCenterId.center_id }
      );
      patientDetails.is_user_from_hub = getCenterInfo.is_hub === "yes";

      if (patientDetails.is_user_from_hub) {
        if (
          patientDetails.is_hub_patient ||
          (patientDetails.in_transition && patientDetails.is_spoke_patient)
        ) {
          patientDetails.can_edit_patient_details = true;
          patientDetails.show_original_name = true;
        } else {
          patientDetails.can_edit_patient_details = false;
          patientDetails.show_original_name = false;
        }
      } else {
        if (patientDetails.is_spoke_patient && !patientDetails.in_transition) {
          patientDetails.can_edit_patient_details = true;
          patientDetails.show_original_name = true;
        } else if (
          patientDetails.is_center_patient &&
          !patientDetails.in_transition
        ) {
          patientDetails.can_edit_patient_details = true;
          patientDetails.show_original_name = true;
        } else {
          patientDetails.can_edit_patient_details = false;
          patientDetails.show_original_name = false;
        }
      }

      const patientCenter = await this.ci.db.get("centers", ["center_name"], {
        id: val.center_id,
      });
      patientDetails.center = patientCenter.center_name;

      patientDetails.calculated_times = getPatientCalculatedTimes(
        patientDetails.id
      );
      if (
        patientDetails.calculated_times.times &&
        patientDetails.calculated_times.times.door_to_needle_time !== null
      ) {
        patientDetails.show_ivt_icon = true;
      } else {
        patientDetails.show_ivt_icon = false;
      }

      if (
        patientDetails.calculated_times.times &&
        patientDetails.calculated_times.times.mt_started_time !== null
      ) {
        patientDetails.show_mt_icon = true;
      } else {
        patientDetails.show_mt_icon = false;
      }

      patientTypes.spoke_patients.push(patientDetails);
    }

    const getHubTransitionPatients = await this.ci.db.select(
      "user_patients",
      "*",
      {
        AND: [
          { hub_id: mainHubId },
          {
            OR: [{ in_transition: "1" }, { is_hub: "1" }],
          },
        ],
        ORDER: { created: "DESC" },
      }
    );

    for (const val of getHubTransitionPatients) {
      const patientId = val.patient_id;
      const patientDetails = await this.ci.db.get(
        "patients",
        [
          "id",
          "created_by",
          "name",
          "patient_code",
          "age",
          "gender",
          "last_updated",
          "created",
        ],
        { id: patientId }
      );
      patientDetails.created = new Date(
        patientDetails.created
      ).toLocaleString();

      patientDetails.assets = {
        photos: 0,
        videos: 0,
      };
      patientDetails.assets.photos = await this.ci.db.count("patient_files", {
        AND: [{ patient_id: patientId }, { file_type: "jpg" }],
      });
      patientDetails.assets.videos = await this.ci.db.count("patient_files", {
        AND: [{ patient_id: patientId }, { "file_type[!]": "jpg" }],
      });

      const getStrokeType = await this.ci.db.get(
        "patient_scan_times",
        ["type_of_stroke"],
        { patient_id: patientId }
      );
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
      } else {
        patientDetails.show_stroke_type_text = false;
      }

      patientDetails.patient_checked = patientCheckedbyUser(
        patientDetails.id,
        headerUserId[0],
        patientDetails.last_updated
      );

      patientDetails.is_spoke_patient = val.is_spoke === "1";
      patientDetails.is_hub_patient = val.is_hub === "1";
      patientDetails.is_center_patient = val.is_center === "1";
      patientDetails.in_transition = val.in_transition === "1";

      const getTheUserCenterId = await this.ci.db.get("users", ["center_id"], {
        user_id: headerUserId[0],
      });
      const getCenterInfo = await this.ci.db.get(
        "centers",
        ["id", "short_name", "is_hub"],
        { id: getTheUserCenterId.center_id }
      );
      patientDetails.is_user_from_hub = getCenterInfo.is_hub === "yes";

      if (patientDetails.is_user_from_hub) {
        if (
          patientDetails.is_hub_patient ||
          (patientDetails.in_transition &&
            (patientDetails.is_spoke_patient ||
              patientDetails.is_center_patient))
        ) {
          patientDetails.can_edit_patient_details = true;
          patientDetails.show_original_name = true;
        } else {
          patientDetails.can_edit_patient_details = false;
          patientDetails.show_original_name = false;
        }
      } else {
        if (patientDetails.is_spoke_patient && !patientDetails.in_transition) {
          patientDetails.can_edit_patient_details = true;
          patientDetails.show_original_name = true;
        } else if (
          patientDetails.is_center_patient &&
          !patientDetails.in_transition
        ) {
          patientDetails.can_edit_patient_details = true;
          patientDetails.show_original_name = true;
        } else {
          patientDetails.can_edit_patient_details = false;
          patientDetails.show_original_name = false;
        }
      }

      const patientCenter = await this.ci.db.get("centers", ["center_name"], {
        id: val.center_id,
      });
      patientDetails.center = patientCenter.center_name;

      patientDetails.calculated_times = getPatientCalculatedTimes(
        patientDetails.id
      );
      if (
        patientDetails.calculated_times.times &&
        patientDetails.calculated_times.times.door_to_needle_time !== null
      ) {
        patientDetails.show_ivt_icon = true;
      } else {
        patientDetails.show_ivt_icon = false;
      }

      if (
        patientDetails.calculated_times.times &&
        patientDetails.calculated_times.times.mt_started_time !== null
      ) {
        patientDetails.show_mt_icon = true;
      } else {
        patientDetails.show_mt_icon = false;
      }

      patientTypes.hub_patients.push(patientDetails);
    }

    patientTypes.centers = [];

    if (getCenterInfo.is_hub === "yes") {
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

    const output = printData("success", patientTypes);
    return response.withJson(output, 200);
  } else {
    const output = printData("error", { message: "INVALID_CREDENTIALS" });
    return response.withJson(output, 403);
  }
};

const getSinglePatient = async (req,res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  const patientId = req.params.patientId;

  if (headerUserId && headerUserToken) {
    const patientDetails = getPatientDetails(patientId, headerUserId);

    const output = { status: 'success', data: patientDetails };
    res.status(200).json(output);
  } else {
    const output = { status: 'error', message: 'INVALID_CREDENTIALS' };
    res.status(403).json(output);
  }
}

const getPatientDetails = async(patientID, userId) => {
    // Get the information of the patient
    let patient = await this.ci.db.get("patients", "*", { "id": patientID });
    patient.covid_score = parseInt(patient.covid_score);
    patient.covid_values = JSON.parse(patient.covid_values);

    patient.created = new Date(patient.created * 1000).toLocaleString();
    patient.datetime_of_stroke_formatted = new Date(patient.datetime_of_stroke * 1000).toLocaleString();

    // Check if patient information checked already
    patient.patient_checked = await this.patientCheckedbyUser(patient.id, userId, patient.last_updated);

    patient.last_update = await this.ci.db.get("patient_updates", "*", { "patient_id": patientID }, { "ORDER": { "id": "DESC" } });
    if (patient.last_update && patient.last_update.id) {
        patient.last_update.user_id = this.getUserDetailsBasic(patient.last_update.user_id);
    }

    patient.last_message = await this.getLastMessageFromPatientConversations(userId, patientID);

    // Calculate Age of the patient
    const today = new Date();
    const dateOfBirth = new Date(patient.date_of_birth);
    const ageDiff = Math.abs(today - dateOfBirth);
    patient.age = Math.floor(ageDiff / (1000 * 60 * 60 * 24 * 365.25));

    const datetimeStrokeStarts = new Date(patient.datetime_of_stroke).getTime();
    const datetimeStrokeEnds = new Date(patient.datetime_of_stroke_timeends).getTime();
    const currentTime = new Date().getTime();

    if (currentTime > datetimeStrokeStarts) {
        patient.show_increment_timer = true;
    }

    const getPatientTransitionStatusesOfEntry = await this.ci.db.query("SELECT created, id, status_id, title FROM `transition_statuses_view` WHERE patient_id = " + patientID + " AND (status_id = 1 OR status_id = 2 OR status_id = 19) ORDER BY id DESC LIMIT 1");
    for (let key in getPatientTransitionStatusesOfEntry) {
        if (typeof getPatientTransitionStatusesOfEntry[key] === "object") {
            delete getPatientTransitionStatusesOfEntry[key];
        }
    }
    if (getPatientTransitionStatusesOfEntry.length > 0) {
        const fortyfiveminsStart = new Date(getPatientTransitionStatusesOfEntry[0].created).getTime();
        const fortyfiveminsEnds = new Date(fortyfiveminsStart + 45 * 60 * 1000).toLocaleString();
        if (currentTime > fortyfiveminsStart && currentTime < new Date(fortyfiveminsEnds).getTime()) {
            patient.show_decrement_timer = true;
            patient.datetime_of_procedure_to_be_done = fortyfiveminsEnds;
        } else {
            patient.show_decrement_timer = false;
            patient.datetime_of_procedure_to_be_done = fortyfiveminsEnds;
        }
    }

    // Hide Decrement timer if TFSO is more than 4.5 hours
    const checkTFSO = new Date(new Date(patient.datetime_of_stroke).getTime() + 4.5 * 60 * 60 * 1000).toLocaleString();
    if (datetimeStrokeStarts > currentTime) {
        patient.show_decrement_timer = false;
    }

    // Stop all timers if any of the status is available: IVT and MT ineligible, or Clock is stopped
    const getPatientTransitionStatusesOfEntryForStoppingClock = await this.ci.db.query("SELECT created, id, status_id, title FROM `transition_statuses_view` WHERE patient_id = " + patientID + " AND (status_id = 11 OR status_id = 16 OR status_id = 17 OR status_id = 23 OR status_id = 25) ORDER BY id DESC LIMIT 1");
    for (let key in getPatientTransitionStatusesOfEntryForStoppingClock) {
        if (typeof getPatientTransitionStatusesOfEntryForStoppingClock[key] === "object") {
            delete getPatientTransitionStatusesOfEntryForStoppingClock[key];
        }
    }

    if (getPatientTransitionStatusesOfEntryForStoppingClock.length > 0) {
        const clockedStoppedat = new Date(getPatientTransitionStatusesOfEntryForStoppingClock[0].created);
        const dateA = new Date(patient.datetime_of_stroke);
        const dateB = new Date(clockedStoppedat);
        const interval = new Date(dateA - dateB);

        const dateArray = [];
        if (interval.getUTCDate() > 0) {
            dateArray.push(interval.getUTCDate() + "d");
        }
        if (interval.getUTCHours() > 0) {
            dateArray.push(interval.getUTCHours() + "h");
        }
        if (interval.getUTCMinutes() > 0) {
            dateArray.push(interval.getUTCMinutes() + "m");
        }
        if (interval.getUTCSeconds() > 0) {
            dateArray.push(interval.getUTCSeconds() + "s");
        }
        patient.show_increment_timer = false;
        patient.show_tfso_total_time_message_box = true;
        patient.show_total_time_taken_from_entry = dateArray.join(" : ");

        // Needle Time Clock
        const getPatientIVTTimes = this.ci.db.get("patient_ivt_times", "*", { "patient_id": patientID }, { "ORDER": { "id": "DESC" } });
        if (getPatientIVTTimes && getPatientIVTTimes.id) {
            patient.needle_time_at_stroke_entry = new Date(patient.datetime_of_stroke).getTime();
            patient.needle_time_total_time = new Date(getPatientIVTTimes.datetime_of_stroke + getPatientIVTTimes.time * 1000);
        } else {
            patient.needle_time_at_stroke_entry = null;
            patient.needle_time_total_time = null;
        }

    } else {
        patient.show_tfso_total_time_message_box = false;
    }

    return patient;
}

module.exports = { addPatient, getUserPatients,getSinglePatient };
