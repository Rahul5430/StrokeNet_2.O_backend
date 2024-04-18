const { executeQuery } = require("../config/sqlDatabase");
const { ValidateUser } = require("./authController");
const { updatePatientStatus } = require('./BaseController');

async function fetchTransitionStatuses(patientId) {
  try {
      // Check if the patient is transitioned
      const checkPatientTransitioned = await executeQuery(
          `SELECT in_transition, is_spoke, is_hub FROM user_patients WHERE patient_id = ?`,
          [patientId]
      );

      // Get punched statuses
      const getPunchedStatuses = await executeQuery(
          `SELECT * FROM transition_statuses_view WHERE patient_id = ? ORDER BY id DESC`,
          [patientId]
      );

      // Format date and time fields for punched statuses
      getPunchedStatuses.forEach(status => {
          status.user_role = status.user_role.replace(/_/g, ' ').toUpperCase();
          status.date = new Date(status.created).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
          status.time = new Date(status.created).toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
      });

      // Get all statuses from the status_types table
      const getAllStatuses = await executeQuery(
          `SELECT * FROM status_types ORDER BY position ASC`
      );

      // Organize statuses by location type and exclude punched statuses
      const statusTypes = {};
      getAllStatuses.forEach(status => {
          if (!statusTypes[status.loc_type]) {
              statusTypes[status.loc_type] = [];
          }
          statusTypes[status.loc_type].push(status);
      });

      // Filter available statuses based on patient's transition status
      let availableStatuses = [];
      if (checkPatientTransitioned[0].in_transition === '0' && checkPatientTransitioned[0].is_spoke === '1') {
          availableStatuses = statusTypes['spoke'];
      } else {
          availableStatuses = statusTypes['hub'];
      }

      // Remove certain statuses from available statuses
      const excludedStatuses = [25, 24, 17, 16, 15, 14];
      availableStatuses = availableStatuses.filter(status => !excludedStatuses.includes(status.id));

      // Prepare output array
      const allStatuses = {
          available: availableStatuses,
          punched: getPunchedStatuses
      };

      return allStatuses;
  } catch (error) {
      console.error('Error fetching transition statuses:', error);
      throw error; // Forward the error to the caller
  }
}

const postTransitionStatus = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if (ValidateUser(headerUserId, headerUserToken)) {
    const data = req.body;

    const errors = [];

    if (!data["patient_id"] || data["patient_id"] === "") {
      errors.push("patient_id is required");
    }

    if (!data["status_id"] || data["status_id"] === "") {
      errors.push("status_id is required");
    }

    if (errors.length > 0) {
      const output = { data: { message: errors[0] } };
      return res.json(output, 403);
    } else {
      //   const getUserCenterId = this.ci.db.get("users", ["center_id"], {
      //     user_id: headerUserId[0],
      //   });

      const [getUserCenterId] = await executeQuery(
        "SELECT center_id FROM usercollection WHERE id=?",
        [headerUserId]
      );

      const insertStatusData = {
        user_id: headerUserId,
        patient_id: data["patient_id"],
        status_id: data["status_id"],
        center_id: getUserCenterId.center_id,
        created: new Date().toISOString(),
      };

      const inserted = await executeQuery(
        `INSERT INTO transition_statuses (user_id,patient_id,status_id,center_id,created) VALUES (?, ?, ?, ?, NOW())`,
        [
          insertStatusData.user_id,
          insertStatusData.patient_id,
          insertStatusData.status_id,
          insertStatusData.center_id,
        ]
      );
      if (inserted) {
        await executeQuery(
          `UPDATE patients SET last_updated = NOW() WHERE id = ?`,
          [insertStatusData.patient_id]
        );
        //     this.ci.db.update(
        //       "user_patients",
        //       { last_updated: new Date().toISOString() },
        //       { patient_id: data["patient_id"] }
        //     );

        //     // Send message to all people about the status change
        //     const getPatientNameCode = this.ci.db.get(
        //       "patients",
        //       ["name", "patient_code"],
        //       { id: data["patient_id"] }
        //     );
        const getStatusInfo = await executeQuery(
          `SELECT title from status_types WHERE id=?`,
          [data["status_id"]]
        );

        //     const getPushIDs = getOneSignalIdsOfTheRadioWithoutDiagnosisUsers(
        //       data["patient_id"]
        //     );

        //     if (getPushIDs.pushIDs.length > 0) {
        //       const pushData = {
        //         title:
        //           "Status Changed: " +
        //           getPatientNameCode.name +
        //           "(" +
        //           getPatientNameCode.patient_code +
        //           ")",
        //         message:
        //           data["status_id"] === "3" ||
        //           data["status_id"] === "5" ||
        //           data["status_id"] === "20"
        //             ? "Patient is being shifted to CT."
        //             : "Status has been changed to: " + getStatusInfo.title,
        //         url:
        //           "snetchd://strokenetchandigarh.com/patient_detail/" +
        //           data["patient_id"],
        //         devices: getPushIDs.pushIDs,
        //       };

        //       sendPush(pushData);

        //       // Send SMS (Code for sending SMS is commented out)
        //       /*
        //         const phoneNumbers = getPushIDs.mobileNumbers.map(phoneNumber => "+91" + phoneNumber);
        //         const smsData = {
        //             to: phoneNumbers.join("<"),
        //             message: `Status Changed: ${getPatientNameCode.name} (${getPatientNameCode.patient_code}). ${data['status_id'] === "3" || data['status_id'] === "5" || data['status_id'] === "20" ?
        //               "Patient is being shifted to CT." :
        //               "Status has been changed to: " + getStatusInfo.title}`,
        //         };
        //         sendSMS(smsData);
        //         */
        //     }

        //     // If status = 3 or 5 (Shift to CT), send push notification to Radiology People
        if (
          data["status_id"] === "3" ||
          data["status_id"] === "5" ||
          data["status_id"] === "20"
        ) {
          const getRadioPushIDs = getOneSignalIdsOfTheRadioDiagnosisUsers(
            data["patient_id"]
          );

          //       if (getRadioPushIDs.pushIDs.length > 0) {
          //         const pushData = {
          //           title: "Acute Stroke arriving for CT",
          //           message: `Patient (${getPatientNameCode.name}) is being shifted to CT.`,
          //           url:
          //             "snetchd://strokenetchandigarh.com/patient_detail/" +
          //             data["patient_id"],
          //           devices: getRadioPushIDs.pushIDs,
          //         };

          //         sendPush(pushData);

          //         // Send SMS (Code for sending SMS is commented out)
          //         /*
          //           const phoneRNumbers = getRadioPushIDs.mobileNumbers.map(phoneNumber => "+91" + phoneNumber);
          //           const smsData = {
          //               to: phoneRNumbers.join("<"),
          //               message: `Acute Stroke arriving for CT. Patient (${getPatientNameCode.name}) is being shifted to CT.`,
          //           };
          //           sendSMS(smsData);
          //           */

          //         // Update patients table scans_needed = 1
          // this.ci.db.update(
          //   "patients",
          //   { scans_needed: "1", last_updated: new Date().toISOString() },
          //   { id: data["patient_id"] }
          // );
          await executeQuery(
            `UPDATE patients SET scans_needed=?,last_updated=NOW() WHERE id=?`,
            [data["patient_id"]]
          );
          //         this.ci.db.update(
          //           "user_patients",
          //           { last_updated: new Date().toISOString() },
          //           { patient_id: data["patient_id"] }
          //         );
          //       }
          //     }

          //     // Global Status
              const updateData = {
                user_id: headerUserId[0],
                patient_id: data["patient_id"],
                update_type: "status_update",
                url:
                  "snetchd://strokenetchandigarh.com/patient_analysis/" +
                  data["patient_id"] +
                  "/status",
                last_updated: new Date().toISOString(), 
              }
              updatePatientStatus(updateData);
          // Global Status
        }

        const output = {
          data: {
            message: "Status was updated successfully.",
            transition_statuses: fetchTransitionStatuses(data["patient_id"]),
          },
        };

        return res.status(200).json(output);
      } else {
        const output = {
          data: {
            message: "Problem posting your status. Please try again.",
          },
        };
        return res.status(400).json(output);
      }
    }
  } else {
    const output = {
      data: { message: "INVALID_CREDENTIALS" },
    };
    return res.staus(403).json(output);
  }
};

const postComment = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if (ValidateUser(headerUserToken && headerUserId)) {
    const patientId = req.body.patientId;
    const message = req.body.message;
    await executeQuery(
      `INSERT INTO comments (patient_id, user_id, message) VALUES (?, ?, ?)`,
      [patientId, headerUserId, message]
    );
    // const patient = await Patient.findById(patientId);
    const [user] = await executeQuery(
      `SELECT u.id, u.fullname FROM usercollection AS u WHERE id=?`,
      [headerUserId]
    );

    const newMsg = {
      message: message,
      fullname: user.fullname,
      user_id: user.id,
      created: Date.now(),
    };
    console.log(newMsg);
    // comments.push(newMsg);
    // patient.last_message = {
    //   last_message: newMsg.message,
    //   last_message_at: newMsg.created,
    //   user: {
    //     fullname: user.fullname,
    //     user_role: user.user_role,
    //   },
    // };
    // await patient.save();
    res.status(200).send(newMsg);
  } else {
    res.send(403).status("hello");
  }
};

const getComments = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if (ValidateUser(headerUserToken && headerUserId)) {
    try {
      const patientId = req.params.PatientId;
      const patientComments = await executeQuery(
        `SELECT 
    u.fullname AS fullname,
    u.id AS user_id,
    c.*
FROM 
    comments c
JOIN 
    usercollection u ON c.user_id = u.id
WHERE 
    c.patient_id = ?
ORDER BY 
    c.created ASC;
`,
        [patientId]
      );

      // const formattedComments = patientComments.map(comment => {
      //   return {
      //     user_id: JSON.parse(comment.user_id),
      //     id: comment.id,
      //     patient_id: comment.patient_id,
      //     message: comment.message,
      //     created: comment.created
      //   };
      // });

      console.log(patientComments);
      res.status(200).send({ data: patientComments });
    } catch (err) {
      console.log(err);
      const output = { data: { message: "Something Went Wrong" } };
      res.status(403).send(output);
    }
  } else {
    const output = { data: { message: "INVALID_CREDENTIALS" } };
    res.status(403).send(output);
  }
};

module.exports = { postTransitionStatus, postComment, getComments };
