const admin = require("firebase-admin");
const {
  calculateAge,
  sendNotification,
  patientCheckedbyUser,
} = require("./BaseController");
const fs = require("fs");
const path = require("path");
const { ValidateUser } = require("./authController");
const { executeQuery } = require("../config/sqlDatabase");
const moment = require("moment");

// Initialize Firebase Storage
// const storage = new Storage({
// 	projectId: serviceAccount.project_id,
// 	credentials: serviceAccount,
// });

const uploadFile = async (req, res) => {
  try {
    const headerUserId = req.headers.userid;
    const headerUserToken = req.headers.usertoken;

    // Validate user (you can implement your user validation logic here)
    if (await ValidateUser(headerUserId, headerUserToken)) {
      if (!req.file) {
        return res.status(400).send("No file uploaded.");
      }
      const storage = admin.storage();
      const bucket = storage.bucket();
      const file = bucket.file(req.file.originalname);

      // Create a write stream to upload file data
      const fileStream = file.createWriteStream({
        metadata: {
          contentType: req.file.mimetype, // Set the content type based on the uploaded file
        },
      });

      fileStream.on("error", (err) => {
        console.error("Error uploading file:", err);
        res.status(500).send("Error uploading file.");
      });

      fileStream.on("finish", async () => {
        // File upload complete
        await file.makePublic();
        console.log(req.file.originalname);
        res.status(200).send(req?.file?.originalname);
      });

      // // Pipe the file data from req.file.buffer to Firebase Storage
      fileStream.end(req.file.buffer);
      // const fileName = req.file?.originalname;
      // res.status(200).json(fileName);
    } else {
      console.log("invalid cred");
      return res.status(403).json({ data: { message: "INVALID_CREDENTIALS" } });
    }
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(500).json({ data: { message: "An error occurred" } });
  }
};

async function getPatientCalculatedTimes(patientId) {
  const finalTimeArray = {};

  // Assuming executeQuery is an asynchronous function that uses Promises
  const getPatientTableTimes = await executeQuery(
    `SELECT admission_time, datetime_of_stroke FROM patients WHERE id = ?`,
    [patientId]
  );
  const patientTableTimes = getPatientTableTimes[0]; // Assuming the result is an array of rows
  finalTimeArray["admission_time"] = patientTableTimes.admission_time;
  finalTimeArray["datetime_of_stroke"] = patientTableTimes.datetime_of_stroke;

  const getPatientScanTimes = await executeQuery(
    `SELECT ct_scan_time, mr_mra_time, dsa_time_completed FROM patient_scan_times WHERE patient_id = ?`,
    [patientId]
  );
  const patientScanTimes = getPatientScanTimes[0];
  finalTimeArray["ct_scan_time"] = patientScanTimes.ct_scan_time;

  const getPatientIVTTimes = await executeQuery(
    `SELECT door_to_needle_time FROM patient_ivt_medications WHERE patient_id = ?`,
    [patientId]
  );
  const patientIVTTimes = getPatientIVTTimes[0];
  finalTimeArray["door_to_needle_time"] = patientIVTTimes.door_to_needle_time;

  const getPatientHubMTStartedTime = await executeQuery(
    `SELECT created FROM transition_statuses WHERE patient_id = ? AND status_id = '6'`,
    [patientId]
  );
  finalTimeArray["mt_started_time"] = getPatientHubMTStartedTime[0]
    ? getPatientHubMTStartedTime[0].created
    : null;

  const getPatientHubMTCompletedTime = await executeQuery(
    `SELECT created FROM transition_statuses WHERE patient_id = ? AND status_id = '18'`,
    [patientId]
  );
  finalTimeArray["mt_completed_time"] = getPatientHubMTCompletedTime[0]
    ? getPatientHubMTCompletedTime[0].created
    : null;

  const calculatedTimes = {
    tfso_time: calculateTimeBetweenTwoTimes(
      finalTimeArray["datetime_of_stroke"],
      finalTimeArray["admission_time"]
    ),
    door_to_ct_time: finalTimeArray["ct_scan_time"]
      ? calculateTimeBetweenTwoTimes(
          finalTimeArray["admission_time"],
          finalTimeArray["ct_scan_time"]
        )
      : null,
    door_to_needle_time: finalTimeArray["door_to_needle_time"]
      ? calculateTimeBetweenTwoTimes(
          finalTimeArray["admission_time"],
          finalTimeArray["door_to_needle_time"]
        )
      : null,
    door_to_groin_puncture: finalTimeArray["mt_started_time"]
      ? calculateTimeBetweenTwoTimes(
          finalTimeArray["admission_time"],
          finalTimeArray["mt_started_time"]
        )
      : null,
    ct_to_groin_puncture:
      finalTimeArray["mt_started_time"] && finalTimeArray["ct_scan_time"]
        ? calculateTimeBetweenTwoTimes(
            finalTimeArray["ct_scan_time"],
            finalTimeArray["mt_started_time"]
          )
        : null,
    door_to_hub_mt_completed: finalTimeArray["mt_completed_time"]
      ? calculateTimeBetweenTwoTimes(
          finalTimeArray["admission_time"],
          finalTimeArray["mt_completed_time"]
        )
      : null,
  };

  return {
    times: finalTimeArray,
    calculated: calculatedTimes,
  };
}

const calculateBulkPatientTimings = async (req, res) => {
  const headerUserId = req.headers["userId"];
  const headerUserToken = req.headers["userToken"];

  if (validateUser(headerUserId, headerUserToken)) {
    const { patientType, timePeriod } = req.params;
    let dateStart = "";
    let dateEnd = "";

    switch (timePeriod) {
      case "past_one_week":
        dateEnd = new Date().toISOString().split("T")[0];
        dateStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        break;
      case "past_one_month":
        dateEnd = new Date().toISOString().split("T")[0];
        dateStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        break;
      case "past_six_months":
        dateEnd = new Date().toISOString().split("T")[0];
        dateStart = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        break;
      case "past_one_year":
        dateEnd = new Date().toISOString().split("T")[0];
        dateStart = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        break;
    }

    let getPatientsQuery = "";
    if (patientType === "ischemic") {
      getPatientsQuery = `SELECT DISTINCT(patient_id) FROM patient_scan_times WHERE type_of_stroke = 'Ischemic' AND DATE(last_updated) BETWEEN '${dateStart}' AND '${dateEnd}'`;
    } else if (patientType === "ivt_bolus") {
      getPatientsQuery = `SELECT DISTINCT(patient_id) FROM transition_statuses WHERE status_id IN ('10', '9', '22') AND DATE(created) BETWEEN '${dateStart}' AND '${dateEnd}'`;
    } else {
      getPatientsQuery = `SELECT DISTINCT(patient_id) FROM transition_statuses WHERE status_id IN ('1', '2', '19') AND DATE(created) BETWEEN '${dateStart}' AND '${dateEnd}'`;
    }

    try {
      const getPatientIds = await pool.query(getPatientsQuery);
      let finalTimes = {
        tfso_time: [],
        door_to_ct_time: [],
        door_to_needle_time: [],
        door_to_groin_puncture: [],
        ct_to_groin_puncture: [],
        door_to_hub_mt_completed: [],
      };
      let totalPatients = 0;

      for (const patientId of getPatientIds.rows) {
        const getPatient = await pool.query(
          `SELECT id FROM patients WHERE id = $1`,
          [patientId.patient_id]
        );

        if (getPatient.rows.length > 0) {
          totalPatients++;

          const getPatientTimes = await getPatientCalculatedTimes(
            patientId.patient_id
          );
          const times = getPatientTimes.calculated;

          if (times.tfso_time)
            finalTimes.tfso_time.push(times.tfso_time.time_in_seconds);
          if (times.door_to_ct_time)
            finalTimes.door_to_ct_time.push(
              times.door_to_ct_time.time_in_seconds
            );
          if (times.door_to_needle_time)
            finalTimes.door_to_needle_time.push(
              times.door_to_needle_time.time_in_seconds
            );
          if (times.door_to_groin_puncture)
            finalTimes.door_to_groin_puncture.push(
              times.door_to_groin_puncture.time_in_seconds
            );
          if (times.ct_to_groin_puncture)
            finalTimes.ct_to_groin_puncture.push(
              times.ct_to_groin_puncture.time_in_seconds
            );
          if (times.door_to_hub_mt_completed)
            finalTimes.door_to_hub_mt_completed.push(
              times.door_to_hub_mt_completed.time_in_seconds
            );
        }
      }

      let averages = {};
      if (finalTimes.tfso_time.length > 0)
        averages.tfso_time = Math.floor(
          finalTimes.tfso_time.reduce((acc, curr) => acc + curr) /
            finalTimes.tfso_time.length
        );
      if (finalTimes.door_to_ct_time.length > 0)
        averages.door_to_ct_time = Math.floor(
          finalTimes.door_to_ct_time.reduce((acc, curr) => acc + curr) /
            finalTimes.door_to_ct_time.length
        );
      if (finalTimes.door_to_needle_time.length > 0)
        averages.door_to_needle_time = Math.floor(
          finalTimes.door_to_needle_time.reduce((acc, curr) => acc + curr) /
            finalTimes.door_to_needle_time.length
        );
      if (finalTimes.door_to_groin_puncture.length > 0)
        averages.door_to_groin_puncture = Math.floor(
          finalTimes.door_to_groin_puncture.reduce((acc, curr) => acc + curr) /
            finalTimes.door_to_groin_puncture.length
        );
      if (finalTimes.ct_to_groin_puncture.length > 0)
        averages.ct_to_groin_puncture = Math.floor(
          finalTimes.ct_to_groin_puncture.reduce((acc, curr) => acc + curr) /
            finalTimes.ct_to_groin_puncture.length
        );
      if (finalTimes.door_to_hub_mt_completed.length > 0)
        averages.door_to_hub_mt_completed = Math.floor(
          finalTimes.door_to_hub_mt_completed.reduce(
            (acc, curr) => acc + curr
          ) / finalTimes.door_to_hub_mt_completed.length
        );

      let finalData = {};
      finalData.total_patients = totalPatients;
      finalData.averages = averages;

      return res.status(200).json({ status: "success", data: finalData });
    } catch (error) {
      return res.status(500).json({ status: "error", message: error.message });
    }
  } else {
    return res
      .status(403)
      .json({ status: "error", message: "INVALID_CREDENTIALS" });
  }
};

const getPatientTimes = async (req, res) => {
  try {
    const patientId = req.params.patientId;
    const patientTimes = await getPatientCalculatedTimes(patientId);
    return res.status(200).json(patientTimes);
  } catch (error) {
    return res.status(500).json({ status: "error", message: error.message });
  }
};

function calculateTimeBetweenTwoTimes(startTime, endTime) {
  if (!startTime || !endTime) return null;
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end - start;
  return Math.floor(diffMs / 1000 / 60); // Convert milliseconds to minutes
}

const addPatient = async (req, res) => {
  try {
    const headerUserId = req.headers.userid;
    const headerUserToken = req.headers.usertoken;

    // Validate user (you can implement your user validation logic here)
    if (await ValidateUser(headerUserId, headerUserToken)) {
      const data = req.body;

      // const user = await UserCollection.findById(headerUserId);

      // if (user.fcm_userid) {
      //   sendNotification(user.fcm_userid, "codeStrokeAlert", {
      //     getCenterInfo: "",
      //     getUserCenterId: "",
      //   });
      // }

      const errors = [];

      if (!data.name || data.name === "") {
        errors.push("Name is required");
      } else if (!data.datetime_of_stroke || data.datetime_of_stroke === "") {
        errors.push("Date/Time of Stroke is required");
      } else if (!data.weakness_side || data.weakness_side === "") {
        errors.push("Weakness side is required");
      }

      const inputDateString = data.datetime_of_stroke;
      const dateObject = new Date(inputDateString);
      const sqlFormattedDate = dateObject
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");
      data.datetime_of_stroke = sqlFormattedDate;
      if (errors.length > 0) {
        return res.status(403).json({ data: { message: errors[0] } });
      } else {
        const patientData = data;
        // patientData.patient_basic_details = {};

        if (data.first_name) {
          patientData.first_name = data.first_name;
          patientData.name = data.first_name;
        }

        if (data.last_name) {
          patientData.last_name = data.last_name;
          patientData.name = `${data.first_name} ${data.last_name}`;
        }

        patientData.age = data.age | null;

        if (data.name) {
          const explodeName = data.name.split(" ");

          if (explodeName[0]) {
            patientData.first_name = explodeName[0];
            // patientData.patient_basic_details.first_name = explodeName[0];
          }

          // if (explodeName[1]) {
          patientData.last_name = explodeName ? explodeName[1] ?? null : null;
          // patientData.patient_basic_details.last_name = explodeName[1];
          // }

          patientData.name = data.name || null;
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
          patientData.gender = data.gender || null;
          // patientData.patient_basic_details.gender = data.gender;
        }

        patientData.nihss_admission = data.nihss_admission || null;

        if (data.weakness_side) {
          patientData.weakness_side = data.weakness_side;
          // patientData.patient_basic_details.weakness_side = data.weakness_side;
        }

        const userQuery = `SELECT * FROM userCollection WHERE id = ?`;
        const userResult = await executeQuery(userQuery, [headerUserId]);

        // Assuming executeQuery returns the user data as an array
        const user = userResult[0];

        // console.log(user);

        // patientData.user_data = {
        //   user_id: user.id,
        //   fullname: user.fullname,
        //   phone_number: user.phone_number,
        // };

        patientData.created_by = headerUserId;

        if (data.contact_number) {
          patientData.contact_number = data.contact_number;
          // patientData.patient_basic_details.contact_number =
          //   data.contact_number;
        }

        if (data.address) {
          patientData.address = data.address;
          // patientData.patient_basic_details.address = data.address;
        }

        if (data.covid_score) {
          patientData.covid_score = data.covid_score;
        }

        if (data.covid_values) {
          patientData.covid_values = data.covid_values;
        }

        patientData.last_updated = sqlFormattedDate;
        patientData.created = sqlFormattedDate;

        const center_id = user.center_id;
        patientData.center_id = center_id;

        // patientData.datetime_of_stroke = formatDate(data.datetime_of_stroke);
        console.log(data.datetime_of_stroke);
        let removeT = data.datetime_of_stroke.replace("T", " ");
        let removeZ = removeT.replace("Z", " ");
        let datetime_of_stroke = removeZ;

        // Adding 4.5 hours to datetime_of_stroke
        let datetime_of_stroke_timeends = moment(datetime_of_stroke)
          .add(4.5, "hours")
          .format("YYYY-MM-DD HH:mm:ss");

        let created = new Date().toISOString();
        let admission_time = new Date()
          .toISOString()
          .replace("T", " ")
          .replace("Z", " ");
        patientData.admission_time = admission_time;

        // Adding 45 minutes to created
        let datetime_of_stroke_fortyfive_deadline = moment(created)
          .add(45, "minutes")
          .format("YYYY-MM-DD HH:mm:ss");
        // More data assignments...
        delete patientData.nihss_admission;
        console.log(patientData);
        const addPatientQuery = `INSERT INTO patients (
          datetime_of_stroke,
          covid_score,
          covid_values,
          name,
          age,
          gender,
          weakness_side,
          first_name,
          last_name,
          created_by,
          last_updated,
          created,
          center_id,
          admission_time,
          datetime_of_stroke_timeends,
          datetime_of_stroke_fortyfive_deadline
      ) VALUES (?, ?, ?, ?, ?, IFNULL(?, gender), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        await executeQuery(addPatientQuery, [
          patientData.datetime_of_stroke,
          patientData.covid_score,
          patientData.covid_values,
          patientData.name,
          patientData.age,
          patientData.gender || undefined,
          patientData.weakness_side,
          patientData.first_name,
          patientData.last_name,
          patientData.created_by,
          patientData.last_updated,
          patientData.created,
          patientData.center_id,
          patientData.admission_time,
          datetime_of_stroke_timeends,
          datetime_of_stroke_fortyfive_deadline,
        ]);

        const lastInsertedIdQuery = `SELECT LAST_INSERT_ID() as lastInsertId`;
        const lastInsertedIdResult = await executeQuery(lastInsertedIdQuery);

        const lastInsertedId = lastInsertedIdResult[0].lastInsertId;

        const [getCenterInfo] = await executeQuery(
          `SELECT * FROM centerscollection WHERE id=?`,
          [user.center_id]
        );

        const generatePatientCode = `${getCenterInfo.short_name}-${new Date()
          .toISOString()
          .slice(2, 10)}${lastInsertedId}`;

        await executeQuery(
          "UPDATE `patients` SET `patient_code` = ? WHERE `id` = ?",
          [generatePatientCode, lastInsertedId]
        );

        const currentDate = new Date()
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");

        const currentTime = new Date()
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");
        const timeOfStroke = moment(patientData.datetime_of_stroke)
          .subtract(330, "minutes")
          .format("YYYY-MM-DD HH:mm:ss");
        const calculateDifference = calculateTimeBetweenTwoTimes(
          timeOfStroke,
          currentTime
        );

        let isHubUser, isSpokeUser, isCenterUser;

        console.log(getCenterInfo);

        if (getCenterInfo.is_hub === "yes") {
          isHubUser = "1";
          isSpokeUser = "0";
          isCenterUser = "0";

          // Hub/Spoke In Status Insert
          await executeQuery(
            "INSERT INTO transition_statuses (patient_id, center_id, status_id, user_id) VALUES (?, ?, ?, ?)",
            [lastInsertedId, user.center_id, 1, headerUserId]
          );

          if (calculateDifference.time_in_seconds > 16200) {
            await executeQuery(
              "INSERT INTO transition_statuses (patient_id, center_id, status_id, user_id) VALUES (?, ?, ?, ?)",
              [lastInsertedId, user.center_id, 12, headerUserId]
            );
          }
        } else {
          isHubUser = "0";
          isSpokeUser = "0";
          isCenterUser = "0";

          if (getCenterInfo.is_center === "yes") {
            isHubUser = "0";
            isSpokeUser = "0";
            isCenterUser = "1";

            await executeQuery(
              "INSERT INTO transition_statuses (patient_id, center_id, status_id, user_id) VALUES (?, ?, ?, ?)",
              [lastInsertedId, user.center_id, 19, headerUserId]
            );

            if (calculateDifference.time_in_seconds > 16200) {
              await executeQuery(
                "INSERT INTO transition_statuses (patient_id, center_id, status_id, user_id) VALUES (?, ?, ?, ?)",
                [lastInsertedId, user.center_id, 23, headerUserId]
              );
            }
          } else {
            isHubUser = "0";
            isSpokeUser = "1";
            isCenterUser = "0";

            await executeQuery(
              "INSERT INTO transition_statuses (patient_id, center_id, status_id, user_id) VALUES (?, ?, ?, ?)",
              [lastInsertedId, user.center_id, 2, headerUserId]
            );

            if (calculateDifference.time_in_seconds > 16200) {
              await executeQuery(
                "INSERT INTO transition_statuses (patient_id, center_id, status_id, user_id) VALUES (?, ?, ?, ?)",
                [lastInsertedId, user.center_id, 11, headerUserId]
              );
            }
          }
        }

        const getPatientQuery = `SELECT * FROM patients WHERE id = ?`;
        const [insertedPatientResult] = await executeQuery(getPatientQuery, [
          lastInsertedId,
        ]);

        const addPatientNihssQuery = `INSERT INTO patient_nihss (patient_id, nihss_time)
        VALUES
            (${lastInsertedId}, '24_hours'),
            (${lastInsertedId}, 'discharge'),
            (${lastInsertedId}, 'admission');
        `;

        await executeQuery(addPatientNihssQuery);
        const fetchPatientNihss = `SELECT nihss_time, nihss_value, nihss_options FROM patient_nihss WHERE patient_id = ${lastInsertedId}`;
        // Extract the inserted patient object
        const patientNihssData = await executeQuery(fetchPatientNihss);
        const insertedPatient = insertedPatientResult;
        insertedPatient.patient_nihss = {};
        patientNihssData.forEach((row) => {
          insertedPatient.patient_nihss[row.nihss_time] = {
            nihss_value: row.nihss_value,
            nihss_options: row.nihss_options || "",
          };
        });

        const addPatientMrsQuery = `INSERT INTO patient_mrs (patient_id, mrs_time)
        VALUES
            (${lastInsertedId}, '1_month'),
            (${lastInsertedId}, 'discharge'),
            (${lastInsertedId}, '3_months');
        `;

        await executeQuery(addPatientMrsQuery);
        const fetchPatientMrs = `SELECT mrs_time, mrs_points, mrs_options FROM patient_mrs WHERE patient_id = ${lastInsertedId}`;
        // Extract the inserted patient object
        const patientMrsData = await executeQuery(fetchPatientMrs);
        insertedPatient.patient_mrs = {};
        patientMrsData.forEach((row) => {
          insertedPatient.patient_mrs[row.mrs_time] = {
            mrs_points: row.mrs_points,
            mrs_options: row.mrs_options || "",
          };
        });

        const addPatientComplicationsQuery = `INSERT INTO patient_complications (patient_id)
        VALUES (${lastInsertedId})`;
        await executeQuery(addPatientComplicationsQuery);

        const fetchPatientComplicationsQuery = `SELECT * FROM patient_complications WHERE patient_id = ${lastInsertedId}`;
        const [patientComplications] = await executeQuery(
          fetchPatientComplicationsQuery
        );
        insertedPatient.patient_complications = patientComplications;

        const addPatientScanTimesQuery = `INSERT INTO patient_scan_times (patient_id)
        VALUES (${lastInsertedId})`;
        await executeQuery(addPatientScanTimesQuery);

        const fetchPatientScanTimesQuery = `SELECT * FROM patient_scan_times where patient_id = ${lastInsertedId}`;
        const [patientScanTimes] = await executeQuery(
          fetchPatientScanTimesQuery
        );
        insertedPatient.patient_scan_times = patientScanTimes;

        await executeQuery(
          `INSERT INTO user_patients (
              center_id, 
              patient_id, 
              user_id, 
              is_hub, 
              hub_id, 
              is_spoke, 
              is_center, 
              in_transition, 
              last_updated
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            user.center_id,
            lastInsertedId,
            headerUserId,
            isHubUser === "1" ? 1 : 0,
            isHubUser === "1" ? user.center_id : getCenterInfo.main_hub,
            isSpokeUser === "1" ? 1 : 0,
            isCenterUser === "1" ? 1 : 0,
            0,
          ]
        );

        await executeQuery(
          "INSERT INTO patient_presentation (patient_id) VALUES (?)",
          [lastInsertedId]
        );
        await executeQuery(
          "INSERT INTO patient_contradictions (patient_id) VALUES (?)",
          [lastInsertedId]
        );
        await executeQuery(
          "INSERT INTO patient_ivt_medications (patient_id) VALUES (?)",
          [lastInsertedId]
        );

        let codeStrokeTransitionId;

        if (getCenterInfo.is_hub === "yes") {
          codeStrokeTransitionId = 14; // Code Stroke Status Code from Hub
        } else if (getCenterInfo.is_center === "yes") {
          codeStrokeTransitionId = 24;
        } else {
          codeStrokeTransitionId = 15; // Code Stroke Status Code from Spoke
        }

        const insertQuery = `
    INSERT INTO transition_statuses (patient_id, center_id, status_id, user_id, created)
    VALUES (?, ?, ?, ?, ?)
`;

        const queryParams = [
          data.patient_id,
          user.center_id,
          codeStrokeTransitionId,
          headerUserId,
          currentDate,
        ];

        try {
          await executeQuery(insertQuery, queryParams);
          console.log("Transition status inserted successfully.");
        } catch (error) {
          console.error("Error inserting transition status:", error);
        }

        // const savedPatient = await Patient.insertMany([patientData]);
        return res.status(200).json({ data: insertedPatient });
      }
    } else {
      console.log("invalid cred");
      return res.status(403).json({ data: { message: "INVALID_CREDENTIALS" } });
    }
  } catch (error) {
    console.error("An error occurred:", error);
    return res.status(500).json({ data: { message: "An error occurred" } });
  }
};

function calculateTimeBetweenTwoTimes(startTime, endTime) {
  if (!startTime || !endTime) return null;
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end - start;
  return Math.floor(diffMs / 1000 / 60); // Convert milliseconds to minutes
}

async function getPatientCalculatedTimes(patientId) {
  const finalTimeArray = {};

  // Assuming executeQuery is an asynchronous function that uses Promises
  const getPatientTableTimes = await executeQuery(
    `SELECT admission_time, datetime_of_stroke FROM patients WHERE id = ?`,
    [patientId]
  );
  const patientTableTimes = getPatientTableTimes[0]; // Assuming the result is an array of rows
  finalTimeArray["admission_time"] = patientTableTimes.admission_time;
  finalTimeArray["datetime_of_stroke"] = patientTableTimes.datetime_of_stroke;

  const getPatientScanTimes = await executeQuery(
    `SELECT ct_scan_time, mr_mra_time, dsa_time_completed FROM patient_scan_times WHERE patient_id = ?`,
    [patientId]
  );
  const patientScanTimes = getPatientScanTimes[0];
  finalTimeArray["ct_scan_time"] = patientScanTimes.ct_scan_time;

  const getPatientIVTTimes = await executeQuery(
    `SELECT door_to_needle_time FROM patient_ivt_medications WHERE patient_id = ?`,
    [patientId]
  );
  const patientIVTTimes = getPatientIVTTimes[0];
  finalTimeArray["door_to_needle_time"] = patientIVTTimes.door_to_needle_time;

  const getPatientHubMTStartedTime = await executeQuery(
    `SELECT created FROM transition_statuses WHERE patient_id = ? AND status_id = '6'`,
    [patientId]
  );
  finalTimeArray["mt_started_time"] = getPatientHubMTStartedTime[0]
    ? getPatientHubMTStartedTime[0].created
    : null;

  const getPatientHubMTCompletedTime = await executeQuery(
    `SELECT created FROM transition_statuses WHERE patient_id = ? AND status_id = '18'`,
    [patientId]
  );
  finalTimeArray["mt_completed_time"] = getPatientHubMTCompletedTime[0]
    ? getPatientHubMTCompletedTime[0].created
    : null;

  const calculatedTimes = {
    tfso_time: calculateTimeBetweenTwoTimes(
      finalTimeArray["datetime_of_stroke"],
      finalTimeArray["admission_time"]
    ),
    door_to_ct_time: finalTimeArray["ct_scan_time"]
      ? calculateTimeBetweenTwoTimes(
          finalTimeArray["admission_time"],
          finalTimeArray["ct_scan_time"]
        )
      : null,
    door_to_needle_time: finalTimeArray["door_to_needle_time"]
      ? calculateTimeBetweenTwoTimes(
          finalTimeArray["admission_time"],
          finalTimeArray["door_to_needle_time"]
        )
      : null,
    door_to_groin_puncture: finalTimeArray["mt_started_time"]
      ? calculateTimeBetweenTwoTimes(
          finalTimeArray["admission_time"],
          finalTimeArray["mt_started_time"]
        )
      : null,
    ct_to_groin_puncture:
      finalTimeArray["mt_started_time"] && finalTimeArray["ct_scan_time"]
        ? calculateTimeBetweenTwoTimes(
            finalTimeArray["ct_scan_time"],
            finalTimeArray["mt_started_time"]
          )
        : null,
    door_to_hub_mt_completed: finalTimeArray["mt_completed_time"]
      ? calculateTimeBetweenTwoTimes(
          finalTimeArray["admission_time"],
          finalTimeArray["mt_completed_time"]
        )
      : null,
  };

  return {
    times: finalTimeArray,
    calculated: calculatedTimes,
  };
}

const getPatientDetails = async (patientID, userId) => {
  // Get the information of the patient
  const [patient] = await executeQuery("SELECT * FROM Patients WHERE id = ?", [
    patientID,
  ]);
  if (!patient) {
    return null;
  }

  patient.patient_checked = patientCheckedbyUser(
    patientID,
    userId,
    patient.last_updated
  );

  const datetimeStrokeStarts = new Date(patient.datetime_of_stroke).getTime();
  const datetimeStrokeEnds = new Date(
    patient.datetime_of_stroke_timeends
  ).getTime();
  const currentTime = new Date().getTime();

  if (currentTime > datetimeStrokeStarts) {
    patient.show_increment_timer = true;
  }

  const results = await executeQuery(
    `SELECT created, id, status_id, title FROM transition_statuses_view WHERE patient_id = 
      ${patientID}
       AND (status_id = 1 OR status_id = 2 OR status_id = 19) ORDER BY id DESC LIMIT 1`
  );

  const getPatientTransitionStatusesOfEntry = results.map((row) => {
    const { created, id, status_id, title } = row;
    return { created, id, status_id, title };
  });

  // Check if there are any results
  if (getPatientTransitionStatusesOfEntry.length > 0) {
    const fortyfiveminsStart = new Date(
      getPatientTransitionStatusesOfEntry[0].created
    );
    const fortyfiveminsEnds = new Date(
      fortyfiveminsStart.getTime() + 45 * 60000
    ); // Adding 45 minutes in milliseconds

    const currentTime = new Date();
    if (currentTime > fortyfiveminsStart && currentTime < fortyfiveminsEnds) {
      patient.show_decrement_timer = true;
      patient.datetime_of_procedure_to_be_done = fortyfiveminsEnds;
    } else {
      patient.show_decrement_timer = false;
      patient.datetime_of_procedure_to_be_done = fortyfiveminsEnds;
    }
  }

  // Hide Decrement timer if TFSO is more than 4.5 hours
  const checkTFSO = new Date(
    new Date(patient.datetime_of_stroke).getTime() + 4.5 * 3600000
  ); // Adding 4.5 hours in milliseconds
  if (checkTFSO > currentTime) {
    patient.show_decrement_timer = false;
  }

  const transitionViewFetch = await executeQuery(
    `SELECT created, id, status_id, title FROM transition_statuses_view WHERE patient_id = 
      ${patientID} 
      AND (status_id = 11 OR status_id = 16 OR status_id = 17 OR status_id = 23 OR status_id = 25) ORDER BY id DESC LIMIT 1`
  );

  const getPatientTransitionStatusesOfEntryForStoppingClock =
    transitionViewFetch.map((row) => {
      const { created, id, status_id, title } = row;
      return { created, id, status_id, title };
    });

  // Check if there are any results
  if (
    getPatientTransitionStatusesOfEntryForStoppingClock &&
    getPatientTransitionStatusesOfEntryForStoppingClock.length > 0
  ) {
    const clockedStoppedat = new Date(
      getPatientTransitionStatusesOfEntryForStoppingClock[0].created
    );

    const date_a = new Date(patient.datetime_of_stroke);
    const date_b = clockedStoppedat;

    const diffTime = Math.abs(date_b - date_a);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(
      (diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const diffMinutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
    const diffSeconds = Math.floor((diffTime % (1000 * 60)) / 1000);

    const date_array = [];
    if (diffDays > 0) {
      date_array.push(diffDays + "d");
    }
    if (diffHours > 0) {
      date_array.push(diffHours + "h");
    }
    if (diffMinutes > 0) {
      date_array.push(diffMinutes + "m");
    }
    if (diffSeconds > 0) {
      date_array.push(diffSeconds + "s");
    }

    patient.show_increment_timer = false;
    patient.show_tfso_total_time_message_box = true;
    patient.show_total_time_taken_from_entry = date_array.join(" : ");

    // Needle Time Clock
    const getPatientIVTTimes = patient_ivt_medications.find(
      (item) => item.patient_id === patient.id
    );
    if (getPatientIVTTimes) {
      const fortfive_date_a = new Date(patient.admission_time);
      const fortfive_date_b = new Date(getPatientIVTTimes.door_to_needle_time);

      const decrement_diffTime = Math.abs(fortfive_date_b - fortfive_date_a);
      const decrement_diffDays = Math.floor(
        decrement_diffTime / (1000 * 60 * 60 * 24)
      );
      const decrement_diffHours = Math.floor(
        (decrement_diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const decrement_diffMinutes = Math.floor(
        (decrement_diffTime % (1000 * 60 * 60)) / (1000 * 60)
      );
      const decrement_diffSeconds = Math.floor(
        (decrement_diffTime % (1000 * 60)) / 1000
      );

      const decrement_date_array = [];
      if (decrement_diffDays > 0) {
        decrement_date_array.push(decrement_diffDays + "d");
      }
      if (decrement_diffHours > 0) {
        decrement_date_array.push(decrement_diffHours + "h");
      }
      if (decrement_diffMinutes > 0) {
        decrement_date_array.push(decrement_diffMinutes + "m");
      }
      if (decrement_diffSeconds > 0) {
        decrement_date_array.push(decrement_diffSeconds + "s");
      }

      patient.show_decrement_timer = false;
      patient.show_45_minutes_deadline_box = true;
      patient.show_45_minutes_taken_deadline = decrement_date_array.join(" : ");
    }
  }

  const getPatientIVTTimesQuery = `SELECT door_to_needle_time FROM patient_ivt_medications WHERE patient_id = ${patient.id}`;
  const getPatientIVTTimes = await executeQuery(getPatientIVTTimesQuery);

  if (getPatientIVTTimes && getPatientIVTTimes.door_to_needle_time) {
    const fortfive_date_a = new Date(patient.admission_time);
    const fortfive_date_b = new Date(getPatientIVTTimes.door_to_needle_time);

    const decrement_interval = Math.abs(fortfive_date_b - fortfive_date_a);
    const decrementDays = Math.floor(
      decrement_interval / (1000 * 60 * 60 * 24)
    );
    const decrementHours = Math.floor(
      (decrement_interval % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const decrementMinutes = Math.floor(
      (decrement_interval % (1000 * 60 * 60)) / (1000 * 60)
    );
    const decrementSeconds = Math.floor(
      (decrement_interval % (1000 * 60)) / 1000
    );

    const decrementDateArray = [];
    if (decrementDays > 0) {
      decrementDateArray.push(decrementDays + "d");
    }
    if (decrementHours > 0) {
      decrementDateArray.push(decrementHours + "h");
    }
    if (decrementMinutes > 0) {
      decrementDateArray.push(decrementMinutes + "m");
    }
    if (decrementSeconds > 0) {
      decrementDateArray.push(decrementSeconds + "s");
    }

    patient.show_decrement_timer = false;
    patient.show_45_minutes_deadline_box = true;
    patient.show_45_minutes_taken_deadline = decrementDateArray.join(" : ");
  }

  // Fetch user data
  const getUserDataQuery = `SELECT id, fullname, phone_number FROM usercollection WHERE id = ?`;
  const userData = await executeQuery(getUserDataQuery, [patient.created_by]);
  patient.user_data = userData[0] || {};

  // Fetch quick information about the patient from user_patients table
  const getUserPatientsQuery = `SELECT * FROM user_patients WHERE patient_id = ${patientID}`;
  const patientQuickData = await executeQuery(getUserPatientsQuery);
  console.log(patientQuickData);
  // Check if the patient is from Spoke
  patient.is_spoke_patient =
    patientQuickData[0] && patientQuickData[0].is_spoke === 1;

  // Check if the patient is from Hub
  patient.is_hub_patient =
    patientQuickData[0] && patientQuickData[0].is_hub === 1;

  // Check if the patient is from center
  patient.is_center_patient =
    patientQuickData[0] && patientQuickData[0].is_center === 1;

  // Check if the user has been transitioned
  patient.in_transition =
    patientQuickData[0] && patientQuickData[0].in_transition === 1;

  // Check if the patient can be transitioned to Hub
  patient.can_be_transitioned_to_hub =
    patient.is_spoke_patient && !patient.in_transition;
  patient.already_transitioned =
    patient.is_spoke_patient && patient.in_transition;

  // Check if the patient can be transitioned to Spoke
  patient.can_be_transitioned_to_spoke =
    patient.is_center_patient && !patient.in_transition;
  patient.already_transitioned =
    patient.is_center_patient && patient.in_transition;

  // Fetch the user's center ID
  const getUserCenterIdQuery = `SELECT center_id FROM usercollection WHERE id = ?`;
  const userCenterIdResult = await executeQuery(getUserCenterIdQuery, [userId]);
  const userCenterId = userCenterIdResult[0].center_id;

  // Fetch center information based on the user's center ID
  const getCenterInfoQuery = `SELECT * FROM centerscollection WHERE id = ${userCenterId}`;
  const centerInfo = await executeQuery(getCenterInfoQuery);
  const isUserFromHub = centerInfo[0].is_hub === "yes";

  // Set whether the user is from the hub
  patient.is_user_from_hub = isUserFromHub;

  // Set center information
  patient.center_info = centerInfo[0];

  // Check permissions based on user and patient details
  if (patient.is_user_from_hub) {
    if (
      patient.is_hub_patient ||
      (patient.in_transition &&
        (patient.is_spoke_patient || patient.is_center_patient))
    ) {
      patient.can_edit_patient_details = true;
      patient.show_original_name = true;
    } else {
      patient.can_edit_patient_details = false;
      patient.show_original_name = false;
    }
  } else {
    if (patient.is_spoke_patient && !patient.in_transition) {
      patient.can_edit_patient_details = true;
      patient.show_original_name = true;
    } else if (patient.is_center_patient && !patient.in_transition) {
      patient.can_edit_patient_details = true;
      patient.show_original_name = true;
    } else {
      patient.can_edit_patient_details = false;
      patient.show_original_name = false;
    }
  }

  if (patient["is_wakeup_stroke"] == "1") {
    patient["is_wakeup_stroke"] = true;
  } else {
    patient["is_wakeup_stroke"] = false;
  }

  //  Check if its a hospital stroke
  if (patient["is_hospital_stroke"] == "1") {
    patient["is_hospital_stroke"] = true;
  } else {
    patient["is_hospital_stroke"] = false;
  }

  if (patient["scans_needed"] == "1") {
    patient["scans_needed"] = true;
  } else {
    patient["scans_needed"] = false;
  }

  if (patient["scans_completed"] == "1") {
    patient["scans_completed"] = true;
  } else {
    patient["scans_completed"] = false;
  }

  if (patient["scans_uploaded"] == "1") {
    patient["scans_uploaded"] = true;
  } else {
    patient["scans_uploaded"] = false;
  }

  // Fetch patient scan times
  const patientScanTimesResult = await executeQuery(
    `SELECT ct_scan_time, mr_mra_time, dsa_time_completed, type_of_stroke, lvo, lvo_types, lvo_site, aspects FROM patient_scan_times WHERE patient_id = ${patientID}`
  );
  const patientScanTimes = patientScanTimesResult[0];

  // Assign patient scan times to patient object
  patient.patient_scan_times = patientScanTimes;

  // Check type of stroke
  if (patient.patient_scan_times.type_of_stroke !== null) {
    if (patient.patient_scan_times.type_of_stroke === "Hemorrhagic") {
      patient.show_stroke_type_text = true;
      patient.showIVTProtocolBox = false;
      patient.stroke_type = "H";
    } else {
      patient.show_stroke_type_text = true;
      patient.stroke_type = "I";
      patient.showIVTProtocolBox = true;
    }
  } else {
    patient.show_stroke_type_text = false;
    patient.showIVTProtocolBox = true;
  }

  // Check if LVO is present
  patient.patient_scan_times.lvo = patient.patient_scan_times.lvo === "1";

  // Fetch patient contradictions data
  const getPatientContradictionsQuery = `SELECT contradictions_data, absolute_score, relative_score, ivt_eligible, checked FROM patient_contradictions WHERE patient_id = ${patientID}`;
  const patientContradictionsResult = await executeQuery(
    getPatientContradictionsQuery
  );
  const patientContradictions = patientContradictionsResult[0];

  // Check absolute score
  if (patientContradictions.absolute_score > 0) {
    patientContradictions.show_ivteligible_box = false;
    patientContradictions.show_ivtineligible_box = true;
  } else {
    patientContradictions.show_ivtineligible_box = false;

    // Check conditions for showing ivteligible_box
    if (
      patientContradictions.relative_score === 0 &&
      patientContradictions.checked
    ) {
      patientContradictions.show_ivteligible_box = true;
    }
    if (
      patientContradictions.relative_score > 0 &&
      patientContradictions.checked
    ) {
      patientContradictions.show_ivteligible_box = true;
    }
    if (
      patientContradictions.absolute_score > 0 &&
      patientContradictions.checked
    ) {
      patientContradictions.show_ivteligible_box = false;
    }

    // Set ivt_eligible based on conditions
    if (
      patientContradictions.absolute_score === 0 &&
      patientContradictions.relative_score === 0 &&
      patientContradictions.checked === 1
    ) {
      patientContradictions.ivt_eligible = 1;
    }
  }

  // Convert ivt_eligible and checked to boolean values
  patientContradictions.ivt_eligible = patientContradictions.ivt_eligible === 1;
  patientContradictions.checked = patientContradictions.checked === 1;

  // Assign patient contradictions data to patient object
  patient.patient_contradictions = patientContradictions;

  const getPatientIVTMedicationsQuery = `SELECT medicine, dose_value, patient_weight, total_dose, bolus_dose, infusion_dose, door_to_needle_time FROM patient_ivt_medications WHERE patient_id = ${patientID}`;
  const patientIVTMedicationsResult = await executeQuery(
    getPatientIVTMedicationsQuery
  );
  const patientIVTMedications = patientIVTMedicationsResult[0];

  // Check if door_to_needle_time exists
  if (patientIVTMedications.door_to_needle_time) {
    const dt = new Date(patientIVTMedications.door_to_needle_time);
    const formattedDateTime = dt.toISOString();
    const formattedDateTimeWithOffset = formattedDateTime.slice(0, -1) + "Z"; // Append 'Z' for UTC timezone
    patientIVTMedications.door_to_needle_time = formattedDateTimeWithOffset;

    // Format door_to_needle_time for display
    const doorToNeedleTimeUnix = Date.parse(
      patientIVTMedications.door_to_needle_time
    );
    const doorToNeedleTimeFormatted = new Date(
      doorToNeedleTimeUnix - 330 * 60 * 1000
    ).toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
      hour12: true,
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    patientIVTMedications.door_to_needle_time_formatted =
      doorToNeedleTimeFormatted;
  }

  // Assign patient IVT medications data to patient object
  patient.patient_ivt_medications = patientIVTMedications;

  const fetchPatientNihss = `SELECT nihss_time, nihss_value, nihss_options FROM patient_nihss WHERE patient_id = ${patientID}`;
  // Extract the inserted patient object

  const patientNihssData = await executeQuery(fetchPatientNihss);
  patient.patient_nihss = {};

  patientNihssData.forEach((row) => {
    patient.patient_nihss[row.nihss_time] = {
      nihss_value: row.nihss_value,
      nihss_options: row.nihss_options || "",
    };
  });

  const fetchPatientMrs = `SELECT mrs_time, mrs_points, mrs_options FROM patient_mrs WHERE patient_id = ${patientID}`;
  // Extract the inserted patient object
  const patientMrsData = await executeQuery(fetchPatientMrs);
  patient.patient_mrs = {};
  patientMrsData.forEach((row) => {
    patient.patient_mrs[row.mrs_time] = {
      mrs_points: row.mrs_points,
      mrs_options: row.mrs_options || "",
    };
  });

  const fetchPatientComplicationsQuery = `SELECT * FROM patient_complications WHERE patient_id = ${patientID}`;
  const [patientComplicationsData] = await executeQuery(
    fetchPatientComplicationsQuery
  );

  patient.patient_complications = patientComplicationsData;

  const user_data_query = `select id as user_id, fullname, phone_number from usercollection where id=?`;
  const [user_data] = await executeQuery(user_data_query, [patient.created_by]);
  patient.user_data = user_data;
  console.log(user_data);

  const patientFilesQuery = `SELECT 
  pf.scan_type,
  JSON_ARRAYAGG(JSON_OBJECT('file', pf.file, 'file_type', pf.file_type, 'user_role', u.user_role, 'created', pf.created)) AS scan_files
FROM 
  patient_files pf
JOIN 
  UserCollection u ON pf.user_id = u.id
WHERE 
  pf.patient_id = ?
GROUP BY 
  pf.scan_type`;

  const patientFilesData = await executeQuery(patientFilesQuery, [patientID]);
  patient.patient_files = { ncct: [], cta_ctp: [], mri: [], mra: [] };

  patientFilesData.forEach((item) => {
    patient.patient_files[item?.scan_type] = item?.scan_files;
  });

  const transitionStatusQuery = `
        SELECT created, id, status_id, title 
        FROM transition_statuses_view 
        WHERE patient_id = ? AND status_id IN (1, 2, 19) 
        ORDER BY id DESC 
        LIMIT 1`;
  const transitionStatuses = await executeQuery(transitionStatusQuery, [
    patientID,
  ]);

  if (transitionStatuses.length > 0) {
    const { created } = transitionStatuses[0];
    const fortyFiveMinsLater = new Date(
      new Date(created).getTime() + 45 * 60000
    );
    patient.show_decrement_timer =
      currentTime > new Date(created) && currentTime < fortyFiveMinsLater;
    patient.datetime_of_procedure_to_be_done = fortyFiveMinsLater;
  } else {
    patient.show_decrement_timer = false;
  }

  // Query for stopping the clock based on certain status IDs
  const stopClockQuery = `
        SELECT created 
        FROM transition_statuses_view 
        WHERE patient_id = ? AND status_id IN (11, 16, 17, 23, 25) 
        ORDER BY id DESC 
        LIMIT 1`;
  const stopClockStatuses = await executeQuery(stopClockQuery, [patientID]);

  if (stopClockStatuses.length > 0) {
    const clockedStoppedAt = stopClockStatuses[0].created;
    const strokeDateTime = patient.datetime_of_stroke; // Assuming this is set somewhere in your code
    const dateA = new Date(strokeDateTime);
    const dateB = new Date(clockedStoppedAt);

    const diff = Math.abs(dateB - dateA);
    const diffDays = Math.floor(diff / (24 * 3600 * 1000));
    const diffHours = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000));
    const diffMinutes = Math.floor((diff % (3600 * 1000)) / 60000);
    const diffSeconds = Math.floor((diff % 60000) / 1000);

    let timeComponents = [];
    if (diffDays > 0) timeComponents.push(`${diffDays}d`);
    if (diffHours > 0) timeComponents.push(`${diffHours}h`);
    if (diffMinutes > 0) timeComponents.push(`${diffMinutes}m`);
    if (diffSeconds > 0) timeComponents.push(`${diffSeconds}s`);

    patient.show_increment_timer = false;
    patient.show_tfso_total_time_message_box = true;
    patient.show_total_time_taken_from_entry = timeComponents.join(" : ");
  }

  patient.calculated_times = await getPatientCalculatedTimes(patientID);

  return patient;
};

const getUserPatients = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if (await ValidateUser(headerUserId, headerUserToken)) {
    // const getUserCenterId = await User.findById(headerUserId);
    const [user] = await executeQuery(
      "SELECT * FROM usercollection WHERE id = ?",
      [headerUserId]
    );
    // const getCenterInfo = await this.ci.db.get(
    //   "centers",
    //   ["id", "short_name", "is_hub", "main_hub"],
    //   { id: getUserCenterId.center_id }
    // );
    const [getCenterInfo] = await executeQuery(
      "SELECT * FROM centerscollection WHERE id = ?",
      [user.center_id]
    );
    // console.log(getCenterInfo);

    let mainHubId = "";
    if (getCenterInfo.main_hub && getCenterInfo.main_hub !== null) {
      mainHubId = getCenterInfo.main_hub;
    } else {
      mainHubId = user.center_id;
    }

    const patientTypes = {
      spoke_patients: [],
      hub_spoke_patients: [],
      hub_patients: [],
      centers: [],
    };

    let getSpokePatients;

    if (getCenterInfo.is_hub === "yes") {
      getSpokePatients = await executeQuery(
        "SELECT * FROM patients WHERE center_id = ?",
        [user.center_id]
      );
      // getSpokePatients = await this.ci.db.select("user_patients", "*", {
      //   AND: [{ is_hub: "0" }, { in_transition: "0" }, { hub_id: mainHubId }],
      //   ORDER: { created: "DESC" },
      // });
    } else {
      getSpokePatients = await executeQuery(
        "SELECT * FROM patients WHERE center_id = ?",
        [user.center_id]
      );
      // getSpokePatients = await this.ci.db.select("user_patients", "*", {
      //   AND: [{ center_id: getUserCenterId.center_id }, { hub_id: mainHubId }],
      //   ORDER: { created: "DESC" },
      // });
    }
    for (const val of getSpokePatients) {
      const patientDetails = {
        id: val.id,
        created_by: val.created_by,
        name: val.name,
        patient_code: val.id,
        age: val.age,
        gender: val.gender,
        last_updated: val.last_updated,
        created: val.created,
        show_original_name: true,
      };
      patientDetails.assets = { photos: 0, videos: 0 };
      // Object.keys(val.patient_files).forEach((ele) => {
      //   val.patient_files[ele].forEach((file) => {
      //     if (file.file_type.includes("image")) {
      //       patientDetails.assets.photos += 1;
      //     } else patientDetails.assets.videos += 1;
      //   });
      // });
      const getStrokeType = val.patient_scan_times;
      if (
        getStrokeType &&
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
      if (getCenterInfo.is_hub === "yes") {
        patientTypes.hub_patients.push(patientDetails);
      } else {
        patientTypes.spoke_patients.push(patientDetails);
      }
    }
    if (getCenterInfo.is_hub === "yes") {
      // const spokes = await Centers.find({ main_hub: user.center_id });
      const spokes = await executeQuery(
        "SELECT * FROM centerscollection WHERE main_hub = ?",
        [user.center_id]
      );
      console.log(spokes);
      for (const spoke of spokes) {
        const patients = await executeQuery(
          "SELECT * FROM patients WHERE center_id = ?",
          [spoke.id]
        );
        for (const val of patients) {
          const patientDetails = {
            id: val.id,
            created_by: val.created_by,
            name: val.name,
            patient_code: val.id,
            age: val.age,
            gender: val.gender,
            last_updated: val.last_updated,
            created: val.created,
            show_original_name: true,
            center: spoke.center_name,
          };
          patientDetails.assets = { photos: 0, videos: 0 };
          // Object.keys(val.patient_files).forEach((ele) => {
          //   val.patient_files[ele].forEach((file) => {
          //     if (file.file_type.includes("image")) {
          //       patientDetails.assets.photos += 1;
          //     } else patientDetails.assets.videos += 1;
          //   });
          // });
          const getStrokeType = val.patient_scan_times;
          if (
            getStrokeType &&
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
    const output = { data: { message: "INVALID_CREDENTIALS" } };
    return res.status(403).json(output);
  }
};

const getSinglePatient = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  let patientId = req.params.PatientId;

  if (await ValidateUser(headerUserId, headerUserToken)) {
    try {
      if (!patientId) {
        const output = { data: { message: "Invalid Patient Id" } };
        return res.status(403).json(output);
      }
      patientId = parseInt(patientId);
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

const updateBasicData = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;

  if (await ValidateUser(headerUserId, headerUserToken)) {
    const data = req.body;
    console.log(data);

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

      const [updatePatientBasicDetails] = await executeQuery(
        "SELECT * FROM Patients WHERE id = ?",
        [data.patient_id]
      );

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

      if (data.date_of_birth) {
        patientBasicData.date_of_birth = data.date_of_birth;
        updatePatientBasicDetails.date_of_birth = data.date_of_birth;
      }

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
        patientBasicData.is_wakeup_stroke = "1";
      } else patientBasicData.is_wakeup_stroke = "0";

      if (data.is_hospital_stroke && data.is_hospital_stroke) {
        patientBasicData.is_hospital_stroke = "1";
      } else patientBasicData.is_hospital_stroke = "0";

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
        patientBasicData.admission_time = data.admission_time
          .replace("T", " ")
          .replace("Z", "");
      }

      patientBasicData.last_updated = new Date(Date.now())
        .toISOString()
        .slice(0, 19)
        .replace("T", " ");

      updatePatientBasicDetails.patient_basic_details = patientBasicData;

      const user = await executeQuery(
        "SELECT * FROM usercollection WHERE id = ?",
        [headerUserId]
      );

      updatePatientBasicDetails.last_update = {
        update_type: "BasicDetails",
        user_id: {
          user_id: user.id,
          fullname: user.name,
          user_role: user.userRole,
        },
        last_updated: Date.now(),
      };

      updatePatientBasicDetails.last_updated = new Date().toISOString();

      console.log(updatePatientBasicDetails);
      const updateQuery = `
      UPDATE Patients
      SET 
          name = IFNULL(?, name), 
          first_name = IFNULL(?, first_name), 
          last_name = IFNULL(?, last_name), 
          date_of_birth = IFNULL(?, date_of_birth), 
          address = IFNULL(?, address), 
          age = IFNULL(?, age), 
          gender = IFNULL(?, gender), 
          contact_number = IFNULL(?, contact_number), 
          admission_time = IFNULL(?, admission_time), 
          datetime_of_stroke = IFNULL(?, datetime_of_stroke), 
          datetime_of_stroke_timeends = IFNULL(?, datetime_of_stroke_timeends), 
          datetime_of_stroke_fortyfive_deadline = IFNULL(?, datetime_of_stroke_fortyfive_deadline), 
          handedness = IFNULL(?, handedness), 
          weakness_side = IFNULL(?, weakness_side), 
          facial_deviation = IFNULL(?, facial_deviation), 
          co_morbidities = IFNULL(?, co_morbidities), 
          similar_episodes_in_past = IFNULL(?, similar_episodes_in_past), 
          similar_episodes_in_past_text = IFNULL(?, similar_episodes_in_past_text), 
          inclusion_exclusion_assessed = IFNULL(?, inclusion_exclusion_assessed), 
          bp_x = IFNULL(?, bp_x), 
          bp_y = IFNULL(?, bp_y), 
          rbs = IFNULL(?, rbs), 
          inr = IFNULL(?, inr), 
          aspects = IFNULL(?, aspects), 
          body_weight = IFNULL(?, body_weight), 
          blood_group = IFNULL(?, blood_group), 
          scans_needed = IFNULL(?, scans_needed), 
          scans_completed = IFNULL(?, scans_completed), 
          scans_uploaded = IFNULL(?, scans_uploaded), 
          covid_score = IFNULL(?, covid_score), 
          covid_values = IFNULL(?, covid_values), 
          ivt_medication = IFNULL(?, ivt_medication), 
          ivt_careful = IFNULL(?, ivt_careful), 
          is_wakeup_stroke = IFNULL(?, is_wakeup_stroke), 
          is_hospital_stroke = IFNULL(?, is_hospital_stroke), 
          notes = IFNULL(?, notes), 
          last_updated = IFNULL(STR_TO_DATE(?, '%Y-%m-%d %H:%i:%s'), last_updated) 
      WHERE 
          id = ?;
  `;

      const values = [
        patientBasicData.name || undefined,
        patientBasicData.first_name || undefined,
        patientBasicData.last_name || undefined,
        patientBasicData.date_of_birth || undefined,
        patientBasicData.address || undefined,
        patientBasicData.age || undefined,
        patientBasicData.gender || undefined,
        patientBasicData.contact_number || undefined,
        patientBasicData.admission_time || undefined,
        patientBasicData.datetime_of_stroke || undefined,
        patientBasicData.datetime_of_stroke_timeends || undefined,
        patientBasicData.datetime_of_stroke_fortyfive_deadline || undefined,
        patientBasicData.handedness || undefined,
        patientBasicData.weakness_side || undefined,
        patientBasicData.facial_deviation || undefined,
        patientBasicData.co_morbidities || undefined,
        patientBasicData.similar_episodes_in_past || undefined,
        patientBasicData.similar_episodes_in_past_text || undefined,
        patientBasicData.inclusion_exclusion_assessed || undefined,
        patientBasicData.bp_x || undefined,
        patientBasicData.bp_y || undefined,
        patientBasicData.rbs || undefined,
        patientBasicData.inr || undefined,
        patientBasicData.aspects || undefined,
        patientBasicData.body_weight || undefined,
        patientBasicData.blood_group || undefined,
        patientBasicData.scans_needed || undefined,
        patientBasicData.scans_completed || undefined,
        patientBasicData.scans_uploaded || undefined,
        patientBasicData.covid_score || undefined,
        patientBasicData.covid_values || undefined,
        patientBasicData.ivt_medication || undefined,
        patientBasicData.ivt_careful || undefined,
        patientBasicData.is_wakeup_stroke || undefined,
        patientBasicData.is_hospital_stroke || undefined,
        patientBasicData.notes || undefined,
        patientBasicData.last_updated || undefined,
        data.patient_id,
      ];
      const updatedPatient = await executeQuery(updateQuery, values);

      console.log(updatedPatient);

      //   // ci.db.update("user_patients", { last_updated: new Date().toISOString() }, { patient_id: data.patient_id });

      // const updateData = {
      //     user_id: headerUserId,
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
  if (await ValidateUser(headerUserId, headerUserToken)) {
    try {
      const data = req.body;
      const errors = [];
      console.log(data);
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
          patientScanTimes.ct_scan_time = data.ct_scan_time
            .replace("T", " ")
            .substring(0, 19);
        }
        if (data.mr_mra_time && data.mr_mra_time) {
          patientScanTimes.mr_mra_time = data.mr_mra_time
            .replace("T", " ")
            .substring(0, 19);
        }
        if (data.dsa_time_completed && data.dsa_time_completed) {
          patientScanTimes.dsa_time_completed = data.dsa_time_completed
            .replace("T", " ")
            .substring(0, 19);
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

        patientScanTimes.last_updated = new Date()
          .toISOString()
          .replace("T", " ")
          .replace("Z", " ");

        const updatePatientScanTimesQuery = `UPDATE patient_scan_times
        SET 
            ct_scan_time = IFNULL(?, ct_scan_time),
            mr_mra_time = IFNULL(?, mr_mra_time),
            dsa_time_completed = IFNULL(?, dsa_time_completed),
            type_of_stroke = IFNULL(?, type_of_stroke),
            lvo = IFNULL(?, lvo),
            lvo_types = IFNULL(?, lvo_types),
            lvo_site = IFNULL(?, lvo_site),
            aspects = IFNULL(?, aspects),
            last_updated = NOW()
        WHERE patient_id = ?;
        `;

        const values = [
          patientScanTimes.ct_scan_time,
          patientScanTimes.mr_mra_time,
          patientScanTimes.dsa_time_completed,
          patientScanTimes.type_of_stroke,
          patientScanTimes.lvo,
          patientScanTimes.lvo_types,
          patientScanTimes.lvo_site,
          patientScanTimes.aspects,
          data.patient_id,
        ];

        await executeQuery(updatePatientScanTimesQuery, values);

        const updatePatientApectsQuery = `
          UPDATE patients
          SET
            aspects = IFNULL(?, aspects),
            last_updated = NOW()
          WHERE id = ?`;

        await executeQuery(updatePatientApectsQuery, [
          patientScanTimes.aspects,
          data.patient_id,
        ]);
        // const updatePatientScanTimes = await Patient.findById(data.patient_id);
        // updatePatientScanTimes.patient_scan_times = patientScanTimes;

        // updatePatientScanTimes.last_updated = Date.now();
        // updatePatientScanTimes.patient_basic_details.aspects = data.aspects;

        // await updatePatientScanTimes.save();

        // Update last_updated field in Patients collection
        // const updatePatients = await db.collection('patients').updateOne(
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
        //     user_id: headerUserId,
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

const updatePatientMedications = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if (ValidateUser(headerUserId, headerUserToken)) {
    const data = req.body;
    const errors = [];
    if (!data.patient_id || data.patient_id === "") {
      errors.push("patient_id is required");
    }
    if (!data.medicine || data.medicine === "") {
      errors.push("Select a medicine");
    }
    if (!data.patient_weight || data.patient_weight === "") {
      errors.push("Enter patient's body weight");
    }
    if (errors.length > 0) {
      const output = { data: { message: errors[0] } };
      return res.status(403).json(output);
    } else {
      const patientMedicationsData = {};

      if (data.medicine) {
        patientMedicationsData["medicine"] = data.medicine;
      }
      if (data.patient_weight) {
        patientMedicationsData["patient_weight"] = data.patient_weight;
      }
      if (data.dose_value) {
        patientMedicationsData["dose_value"] = data.dose_value;
      }
      if (data.total_dose) {
        patientMedicationsData["total_dose"] = data.total_dose;
      }
      if (data.bolus_dose) {
        patientMedicationsData["bolus_dose"] = data.bolus_dose;
      }
      if (data.infusion_dose) {
        patientMedicationsData["infusion_dose"] = data.infusion_dose;
      }
      if (data.door_to_needle_time) {
        patientMedicationsData["door_to_needle_time"] = data.door_to_needle_time
          .replace("T", " ")
          .replace("Z", " ");
      } else {
        patientMedicationsData["door_to_needle_time"] = null;
      }
      patientMedicationsData["last_updated"] = new Date()
        .toISOString()
        .replace("T", " ")
        .replace("Z", " ");

      const query = `
        UPDATE patient_ivt_medications
        SET medicine = ?, patient_weight = ?, dose_value = ?, total_dose = ?,
            bolus_dose = ?, infusion_dose = ?, door_to_needle_time = ?, last_updated = ?
        WHERE patient_id = ?`;
      const values = [
        patientMedicationsData["medicine"],
        patientMedicationsData["patient_weight"],
        patientMedicationsData["dose_value"],
        patientMedicationsData["total_dose"],
        patientMedicationsData["bolus_dose"],
        patientMedicationsData["infusion_dose"],
        patientMedicationsData["door_to_needle_time"],
        patientMedicationsData["last_updated"],
        data.patient_id,
      ];

      try {
        await executeQuery(query, values);
        // Update last updated field in Patients table
        const updateQuery = `
          UPDATE patients
          SET ivt_medication = ?, body_weight = ?, last_updated = NOW()
          WHERE id = ?`;
        const updateValues = ["1", data.patient_weight, data.patient_id];
        await executeQuery(updateQuery, updateValues);

        const updateUserPatientsQuery = `
          UPDATE user_patients
          SET last_updated = NOW()
          WHERE patient_id = ?`;
        const updateUserPatientsValues = [data.patient_id];
        await executeQuery(updateUserPatientsQuery, updateUserPatientsValues);

        // Update a new status and update
        const getUserCenterIdQuery =
          "SELECT center_id FROM usercollection WHERE id = ?";
        const getUserCenterIdValues = [headerUserId];
        const getUserCenterIdResult = await executeQuery(
          getUserCenterIdQuery,
          getUserCenterIdValues
        );
        const centerId = getUserCenterIdResult[0].center_id;

        const checkCenterQuery =
          "SELECT is_hub, is_center FROM centerscollection WHERE id = ?";
        const checkCenterValues = [centerId];
        const checkCenterResult = await executeQuery(
          checkCenterQuery,
          checkCenterValues
        );
        let statusId = "";
        if (checkCenterResult[0].is_hub === "yes") {
          statusId = "10";
        } else {
          if (checkCenterResult[0].is_center === "yes") {
            statusId = "22";
          } else {
            statusId = "9";
          }
        }
        const insertStatusQuery = `
          INSERT INTO transition_statuses (user_id, patient_id, status_id, center_id)
          VALUES (?, ?, ?, ?)`;
        const insertStatusValues = [
          headerUserId,
          data.patient_id,
          statusId,
          centerId,
        ];
        await executeQuery(insertStatusQuery, insertStatusValues);

        // Global Status
        const updateData = {
          user_id: headerUserId,
          patient_id: data.patient_id,
          update_type: "medications",
          url:
            "snetchd://strokenetchandigarh.com/patient_detail/" +
            data.patient_id,
          last_updated: new Date()
            .toISOString()
            .replace("T", " ")
            .replace("Z", " "),
        };
        // updatePatientStatus(updateData);
        // Global Status

        const output = {
          data: { message: "Medications updated successfully." },
        };
        return res.status(200).json(output);
      } catch (error) {
        const output = { data: { message: error.message } };
        return res.status(500).json(output);
      }
    }
  } else {
    const output = { data: { message: "INVALID_CREDENTIALS" } };
    return res.status(403).json(output);
  }
};

const updatePatientComplications = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if (await ValidateUser(headerUserId, headerUserToken)) {
    const data = req.body;
    console.log(req.body);
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

      const updateQuery = `
      UPDATE patient_complications
      SET 
        bed_sore = IFNULL(?, bed_sore),
        bed_sore_site = ?,
        bed_sore_degree = ?,
        bed_sore_duration = ?,
        bed_sore_photo = ?,
        aspiration = IFNULL(?, aspiration),
        aspiration_duration = ?,
        deep_vein_thrombosis = IFNULL(?, deep_vein_thrombosis),
        deep_vein_thrombosis_site = ?,
        deep_vein_thrombosis_duration = ?,
        frozen_shoulder = IFNULL(?, frozen_shoulder),
        frozen_shoulder_site = ?,
        frozen_shoulder_duration = ?,
        contracture = IFNULL(?, contracture),
        contracture_site = ?,
        contracture_duration = ?,
        spasticity = IFNULL(?, spasticity),
        spasticity_site = ?,
        spasticity_duration = ?,
        cauti = IFNULL(?, cauti),
        cauti_duration = ?,
        others = IFNULL(?, others),
        others_information = ?,
        others_duration = ?,
        last_updated = NOW()
      WHERE patient_id = ?;      
`;

      console.log(patientComplications);

      const valuesComplications = [
        patientComplications.bed_sore || undefined,
        patientComplications.bed_sore_site || undefined,
        patientComplications.bed_sore_degree || undefined,
        patientComplications.bed_sore_duration || undefined,
        patientComplications.bed_sore_photo || undefined,
        patientComplications.aspiration || undefined,
        patientComplications.aspiration_duration || undefined,
        patientComplications.deep_vein_thrombosis || undefined,
        patientComplications.deep_vein_thrombosis_site || undefined,
        patientComplications.deep_vein_thrombosis_duration || undefined,
        patientComplications.frozen_shoulder || undefined,
        patientComplications.frozen_shoulder_site || undefined,
        patientComplications.frozen_shoulder_duration || undefined,
        patientComplications.contracture || undefined,
        patientComplications.contracture_site || undefined,
        patientComplications.contracture_duration || undefined,
        patientComplications.spasticity || undefined,
        patientComplications.spasticity_site || undefined,
        patientComplications.spasticity_duration || undefined,
        patientComplications.cauti || undefined,
        patientComplications.cauti_duration || undefined,
        patientComplications.others || undefined,
        patientComplications.others_information || undefined,
        patientComplications.others_duration || undefined,
        data.patient_id,
      ];

      const rss = await executeQuery(updateQuery, valuesComplications);

      console.log(rss);
      // patientComplications.last_updated = new Date().toISOString();

      // const updatedPatientcomplications = await Patient.findById(
      //   data.patient_id
      // );
      // // console.log(updatedPatientcomplications);
      // updatedPatientcomplications.patient_complications = patientComplications;

      // updatedPatientcomplications.last_updated = Date.now();

      // await updatedPatientcomplications.save();

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
      //   user_id: headerUserId,
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

async function updatePatientContradictions(req, res) {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;

  if (ValidateUser(headerUserId, headerUserToken)) {
    const data = req.body;
    console.log(data);

    const errors = [];

    if (!data.patient_id || data.patient_id === "") {
      errors.push("patient_id is required");
    }

    if (errors.length > 0) {
      const output = printData("error", { message: errors[0] });
      return res.status(403).json(output);
    } else {
      const patientContradictionsData = {};

      patientContradictionsData.contradictions_data =
        data.contradictions_data || null;
      patientContradictionsData.absolute_score = data.absolute_score;
      patientContradictionsData.relative_score = data.relative_score;
      patientContradictionsData.ivt_eligible = data.ivt_eligible;
      patientContradictionsData.checked = 1;
      patientContradictionsData.last_updated = new Date()
        .toISOString()
        .replace("T", " ")
        .replace("Z", " ");

      await executeQuery(
        `UPDATE patient_contradictions SET ? WHERE patient_id = ${data.patient_id}`,
        patientContradictionsData
      );

      await executeQuery(
        `UPDATE patients SET ivt_medication = '1', body_weight = '${data.patient_weight}', last_updated = NOW() WHERE id = ${data.patient_id}`
      );
      await executeQuery(
        `UPDATE user_patients SET last_updated = NOW() WHERE patient_id = ${data.patient_id}`
      );

      if (data.ivt_eligible === "0" && data.absolute_score > 0) {
        const getUserCenterIdResult = await executeQuery(
          `SELECT center_id FROM usercollection WHERE user_id = ?`,
          [headerUserId]
        );
        const getUserCenterId = getUserCenterIdResult[0].center_id;

        const checkCenterResult = await executeQuery(
          `SELECT is_hub, is_center FROM centerscollection WHERE id = ${getUserCenterId}`
        );
        const checkCenter = checkCenterResult[0];

        let statusId = "";

        if (checkCenter.is_hub === "yes") {
          statusId = "12";
        } else {
          if (checkCenter.is_center === "yes") {
            statusId = "23";
          } else {
            statusId = "11";
          }
        }

        const insertStatusData = {
          user_id: headerUserId,
          patient_id: data.patient_id,
          status_id: statusId,
          center_id: getUserCenterId,
          created: new Date().toISOString().replace("T", " ").replace("Z", " "),
        };

        await executeQuery(
          "INSERT INTO transition_statuses SET ?",
          insertStatusData
        );
      }

      const updateData = {
        user_id: headerUserId,
        patient_id: data.patient_id,
        update_type: "ivt_checklist",
        url: `snetchd://strokenetchandigarh.com/patient_detail/${data.patient_id}`,
        last_updated: new Date().toISOString(),
      };

      // updatePatientStatus(updateData);

      const output = {
        data: { message: "IVT Checklist updated successfully." },
      };
      return res.status(200).json(output);
    }
  } else {
    const output = { data: { message: "INVALID_CREDENTIALS" } };
    return res.status(403).json(output);
  }
}

const updateNIHSSofPatient = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if (await ValidateUser(headerUserId, headerUserToken)) {
    const data = req.body;
    const errors = [];
    if (!data.patient_id) errors.push("patient_id is required");
    else if (!data.nihss_time) errors.push("nihss_time is required");
    else if (!data.nihss_value) errors.push("nihss_value is required");

    if (errors.length > 0) {
      return res.status(403).json({ data: { message: errors[0] } });
    } else {
      // Construct the SQL query
      let sql = `UPDATE patient_nihss SET nihss_value = ?`;
      const params = [data.nihss_value];

      if (data.nihss_options) {
        sql += `, nihss_options = ?`;
        params.push(data.nihss_options);
      }

      sql += ` WHERE patient_id = ? AND nihss_time = ?`;
      params.push(data.patient_id, data.nihss_time);

      console.log(params, sql);
      // Execute the query
      try {
        await executeQuery(sql, params);
        res.status(200).json({
          data: {
            message: "NIHSS was updated successfully",
            nihss_data: {
              nihss_time: data.nihss_time,
              nihss_value: data.nihss_value,
              nihss_options: data.nihss_options || null,
            },
          },
        });
      } catch (err) {
        console.error("SQL Error:", err.message);
        res
          .status(500)
          .json({ data: { message: "Failed to update NIHSS data" } });
      }
    }
  } else {
    return res.status(403).json({ data: { message: "INVALID_CREDENTIALS" } });
  }
};

const updateMRSofPatient = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if (await ValidateUser(headerUserId, headerUserToken)) {
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

      // const updatedMRSPatient = await Patient.findById(data.patient_id);
      // updatedMRSPatient.patient_mrs[data.mrs_time].mrs_options =
      //   patientMRS.mrs_options;
      // updatedMRSPatient.patient_mrs[data.mrs_time].mrs_points =
      //   patientMRS.mrs_points;

      // updatedMRSPatient.last_updated = Date.now();
      // await updatedMRSPatient.save();

      const updateQuery = `
      UPDATE patient_mrs
      SET mrs_options = ?,
          mrs_points = ?
      WHERE patient_id = ? AND mrs_time = ?;
  `;

      const valuesMrs = [
        patientMRS.mrs_options,
        patientMRS.mrs_points,
        data.patient_id,
        patientMRS.mrs_time,
      ];
      await executeQuery(updateQuery, valuesMrs);

      // Update last_updated field in Patients table
      // db.update('patients', { last_updated: new Date().toISOString() }, { id: data.patient_id });
      // db.update('user_patients', { last_updated: new Date().toISOString() }, { patient_id: data.patient_id });

      // const patientMRSData = db.select('patient_mrs', ['mrs_time', 'mrs_options'], { patient_id: data.patient_id });
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
        data: { message: "MRS was updated successfully", mrs_data: patientMRS },
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
  console.log("uploaded");
  res.status(200).json(output);
};

const addPatientScanFile = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if (await ValidateUser(headerUserId, headerUserToken)) {
    try {
      // Fetch user details
      const [user] = await executeQuery(
        "SELECT * FROM usercollection WHERE id = ?",
        [headerUserId]
      );

      // Fetch patient details
      const filedata = req.body;
      console.log(filedata);
      const [patient] = await executeQuery(
        "SELECT * FROM patients WHERE id = ?",
        [filedata.patient_id]
      );

      // Insert new scan file
      const insertQuery = `
        INSERT INTO patient_files (patient_id, file_type, file, user_id, scan_type)
        VALUES (?, ?, ?, ?, ?)
      `;

      const dataForDB = [
        filedata.patient_id,
        filedata.file_type,
        filedata.file,
        user.id,
        filedata.scan_type,
      ];
      await executeQuery(insertQuery, dataForDB);

      // // Update patient file details
      // const updateQuery = `
      //   UPDATE patients
      //   SET scans_uploaded = scans_uploaded + 1
      //   WHERE id = ?
      // `;
      // await executeQuery(updateQuery, [filedata.patient_id]);

      const resData = {
        ...filedata,
        user_role: user.user_role,
        created: Date.now(),
      };

      const output = { data: { file: resData, message: "file_uploaded" } };
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
  if (await ValidateUser(headerUserId, headerUserToken)) {
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
      const [patient] = await executeQuery(
        "SELECT * FROM Patients WHERE id = ?",
        [data.patient_id]
      );
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
            // Construct SQL query to delete file from patient_files table
            const deleteQuery = `
              DELETE FROM patient_files
              WHERE patient_id = ? AND file = ? AND file_type = ?
            `;
            await executeQuery(deleteQuery, [
              data.patient_id,
              data.file_id,
              data.scan_type,
            ]);

            // Update patient's total_scans and last_updated fields
            const updateQuery = `
              UPDATE Patients
              SET total_scans = total_scans - 1, last_updated = ?
              WHERE id = ?
            `;
            const currentDate = new Date().toISOString();
            await executeQuery(updateQuery, [currentDate, data.patient_id]);

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
  if (await ValidateUser(headerUserId, headerUserToken)) {
    const data = req.body;
    // console.log(data);
    const errors = [];
    if (!data.patient_id) {
      errors.push("Patient Id is Not Valid");
    }
    if (errors.length > 0) {
      const output = { data: { message: errors[0] } };
      return res.json(output, 403);
    } else {
      const [getPatientCenterId] = await executeQuery(
        "SELECT * FROM Patients WHERE id = ?",
        [data.patient_id]
      );
      const [getCenterInfo] = await executeQuery(
        "SELECT * FROM centerscollection WHERE id = ?",
        [getPatientCenterId.center_id]
      );

      if (getCenterInfo.is_hub == "yes") {
        const Users = await executeQuery(
          "SELECT * FROM usercollection WHERE center_id = ?",
          [getPatientCenterId.center_id]
        );
        Users.forEach((user) => {
          if (user.fcm_userid != "") {
            console.log("hello", user.fcm_userid);
            sendNotification(user.fcm_userid, "codeStrokeAlert", {
              getCenterInfo: getCenterInfo,
              getUserCenterId: getPatientCenterId,
              patientId: data.patient_id,
            });
          }
        });
      } else {
        //   const Users = await User.find({ center_id: getCenterInfo });
        //   Users.forEach((user) => {
        //     if (user.fcm_userid != "") {
        //       sendNotification(user.fcm_userid, "codeStrokeAlert", {
        //         getCenterInfo: getCenterInfo,
        //         getUserCenterId: getUserCenterId,
        //         patientId: data.patient_id,
        //       });
        //     }
        //   });
      }

      const output = { data: { message: "Code Stroke Sent!" } };
      return res.status(200).json(output);

      //   const getUserCenterId = this.ci.db.get(
      //     "users",
      //     ["center_id", "fullname", "user_role"],
      //     { user_id: headerUserId }
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
      //       { center_id: user.center_id }
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
  if (await ValidateUser(headerUserId, headerUserToken)) {
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

const alertHubAndStartTransition = async (req, res, args) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;

  if (ValidateUser(headerUserId, headerUserToken)) {
    const data = req.body;
    const errors = [];
    if (!data.patient_id || data.patient_id === "") {
      errors.push("patient_id is required");
    }

    if (errors.length > 0) {
      const output = {data:{ message: errors[0] }};
      return res.status(403).json(output);
    } else {
      // Add a Transition Status: Spoke Out
      const [getUserCenterId] = await executeQuery(
        "SELECT center_id FROM usercollection WHERE id = ?",
        [headerUserId]
      );
      await executeQuery(
        "INSERT INTO transition_statuses (patient_id, center_id, status_id, user_id) VALUES (?, ?, ?, ?)",
        [
          data.patient_id,
          getUserCenterId.center_id,
          7,
          headerUserId,
        ]
      );

      await executeQuery(
        "UPDATE user_patients SET last_updated = NOW(), in_transition = 1 WHERE patient_id = ?",
        [data.patient_id]
      );
      await executeQuery("UPDATE patients SET last_updated = NOW() WHERE id = ?", [
        data.patient_id,
      ]);

      // Send Push notifications to all the users from the Hub
      const [getCenterInfo] = await executeQuery(
        "SELECT center_name, main_hub FROM centerscollection WHERE id = ?",
        [getUserCenterId.center_id]
      );
      const [hubInfo] = await executeQuery(
        "SELECT id, center_name, center_location FROM centerscollection WHERE id = ?",
        [getCenterInfo.main_hub]
      );
      const getAllUsersOneSignalFromHub = await executeQuery(
        "SELECT fcm_userid, phone_number FROM usercollection WHERE center_id = ?",
        [hubInfo.id]
      );

      // const pushIDs = getAllUsersOneSignalFromHub.map(
      //   (user) => user.onesignal_userid
      // );
      // const phoneNumbers = getAllUsersOneSignalFromHub.map(
      //   (user) => user.phone_number
      // );

      const getPatientNameCode = await executeQuery(
        "SELECT name, patient_code FROM patients WHERE id = ?",
        [data.patient_id]
      );

      // const pushData = {
      //   title: "Code Stroke: Patient Referred",
      //   message: `${getPatientNameCode.name} is being referred from ${getCenterInfo.center_name}`,
      //   url: `snetchd://strokenetchandigarh.com/patient_detail/${data.patient_id}`,
      //   devices: pushIDs,
      // };

      // Call function to send push notification
      // sendPush(pushData);

      // const smsData = {
      //   to: phoneNumbers.join("<"),
      //   message: `Code Stroke: Patient Referred! ${getPatientNameCode.name} is being referred from ${getCenterInfo.center_name}`,
      // };

      // Call function to send SMS
      // sendSMS(smsData);

      const output = {
        data: {
          message: `The patient is in transition to ${hubInfo.center_name} (${hubInfo.center_location})`,
        },
      };
      return res.status(200).json(output);
    }
  } else {
    const output = { message: "INVALID_CREDENTIALS" };
    return res.status(403).json(output);
  }
};

module.exports = {
  uploadFile,
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
  getPatientDetails,
  calculateBulkPatientTimings,
  getPatientTimes,
  updatePatientContradictions,
  updatePatientMedications,
  alertHubAndStartTransition,
};
