const { executeQuery } = require("../config/sqlDatabase");
const { ValidateUser } = require("./authController");
const { updatePatientStatus } = require("./BaseController");

const fetchTransitionStatuses = async (patientId) => {
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
    getPunchedStatuses.forEach((status) => {
      status.user_role = status.user_role.replace(/_/g, " ").toUpperCase();
      status.date = new Date(status.created).toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      status.time = new Date(status.created).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      });
    });

    // Get all statuses from the status_types table
    const getAllStatuses = await executeQuery(
      `SELECT * FROM status_types ORDER BY position ASC`
    );

    // Organize statuses by location type and exclude punched statuses
    const statusTypes = {};
    getAllStatuses.forEach((status) => {
      if (!statusTypes[status.loc_type]) {
        statusTypes[status.loc_type] = [];
      }
      statusTypes[status.loc_type].push(status);
    });

    // Filter available statuses based on patient's transition status
    let availableStatuses = [];
    if (
      checkPatientTransitioned[0].in_transition === "0" &&
      checkPatientTransitioned[0].is_spoke === "1"
    ) {
      availableStatuses = statusTypes["spoke"];
    } else {
      availableStatuses = statusTypes["hub"];
    }

    // Remove certain statuses from available statuses
    const excludedStatuses = [25, 24, 17, 16, 15, 14];
    availableStatuses = availableStatuses.filter(
      (status) => !excludedStatuses.includes(status.id)
    );

    // Prepare output array
    const allStatuses = {
      available: availableStatuses,
      punched: getPunchedStatuses,
    };

    return allStatuses;
  } catch (error) {
    console.error("Error fetching transition statuses:", error);
    throw error; // Forward the error to the caller
  }
};

const getTransitionStatuses = async (req, res) => {
  console.log("Comming");
  const headerUserId = req.headers.userId;
  const headerUserToken = req.headers.usertoken;
  if (ValidateUser(headerUserId, headerUserToken)) {
    const patientId = req.params.PatientId;
    const fetchedTransitionData = await fetchTransitionStatuses(patientId);
    const output = { data: fetchedTransitionData };
    console.log(fetchedTransitionData);
    return res.status(200).json(output);
  } else {
    $output = { data: { mesage: "INVALID_CREDENTIALS" } };
    return res.status(403).json(output);
  }
};

async function fetchOnlineUsers(patientId, userId) {
  try {
    // Check if the patient is from Hub or Spoke
    const getPatient = await executeQuery(
      "SELECT center_id FROM patients WHERE id = ?",
      [patientId]
    );

    const checkCenter = await executeQuery(
      "SELECT id, center_name, short_name, center_location, is_hub, main_hub FROM centerscollection WHERE id = ?",
      [getPatient[0].center_id]
    );

    let getHub = {};
    if (checkCenter[0].is_hub === "yes") {
      getHub = await executeQuery(
        "SELECT id, center_name FROM centerscollection WHERE id = ?",
        [checkCenter[0].main_hub]
      );
      getHub.id = checkCenter[0].id;
    }

    // Get All Online Users from Hub
    const getAllOnlineUsersfromHub = await executeQuery(
      "SELECT id, fullname, user_department, user_role, fcm_userid, online_status, phone_number FROM usercollection WHERE id != ? AND center_id = ? AND online_status = ?",
      [userId, getHub.id, 1]
    );

    for (let i = 0; i < getAllOnlineUsersfromHub.length; i++) {
      getAllOnlineUsersfromHub[i].user_department = formatNames(
        getAllOnlineUsersfromHub[i].user_department
      );
      getAllOnlineUsersfromHub[i].user_role = formatNames(
        getAllOnlineUsersfromHub[i].user_role
      );

      // // Get last message
      // const lastMessageQuery = `SELECT id, firebase_id, last_message, already_read, last_message_at FROM conversations WHERE type = 'patient' AND patient_id = ${patientId} AND ((user_id = ${userId} AND other_user_id = ${getAllOnlineUsersfromHub[i].user_id}) OR (user_id = ${getAllOnlineUsersfromHub[i].user_id} AND other_user_id = ${userId}))`;
      // const lastMessage = await executeQuery(lastMessageQuery);
      // if (lastMessage.length > 0) {
      //   getAllOnlineUsersfromHub[i].last_message = lastMessage[0];
      //   getAllOnlineUsersfromHub[i].last_message_read =
      //     lastMessage[0].already_read === "1";
      // }
    }

    const onlineUsers = {
      hub_users: {
        name: checkCenter[0].center_name + " (Hub)",
        online_users: getAllOnlineUsersfromHub,
      },
    };

    if (checkCenter[0].is_hub !== "yes") {
      const getAllOnlineUsersfromSpoke = await executeQuery(
        "SELECT id, fullname, user_department, user_role, fcm_userid, online_status, phone_number FROM usercollection WHERE id != ? AND center_id = ? AND online_status = ?",
        [userId, getPatient[0].center_id, 1]
      );

      for (let i = 0; i < getAllOnlineUsersfromSpoke.length; i++) {
        getAllOnlineUsersfromSpoke[i].user_department = formatNames(
          getAllOnlineUsersfromSpoke[i].user_department
        );
        getAllOnlineUsersfromSpoke[i].user_role = formatNames(
          getAllOnlineUsersfromSpoke[i].user_role
        );

        // Get last message
        // const lastMessageQuery = `SELECT id, firebase_id, last_message, already_read, last_message_at FROM conversations WHERE type = 'patient' AND patient_id = ${patientId} AND ((user_id = ${userId} AND other_user_id = ${getAllOnlineUsersfromSpoke[i].user_id}) OR (user_id = ${getAllOnlineUsersfromSpoke[i].user_id} AND other_user_id = ${userId}))`;
        // const lastMessage = await executeQuery(lastMessageQuery);
        // if (lastMessage.length > 0) {
        //   getAllOnlineUsersfromSpoke[i].last_message = lastMessage[0];
        //   getAllOnlineUsersfromSpoke[i].last_message_read =
        //     lastMessage[0].already_read === "1";
        // }
      }

      onlineUsers.spoke_users = {
        name: checkCenter[0].center_name + " (Spoke)",
        online_users: getAllOnlineUsersfromSpoke,
      };
    }

    return onlineUsers;
  } catch (error) {
    console.error("Error fetching online users:", error);
    throw error;
  }
}

async function getOnlineUsers(req, res) {
  const headerUserId = req.header.userid;
  const headerUserToken = req.header.usertoken;
  console.log("helllo");
  if (ValidateUser(headerUserId, headerUserToken)) {
    const patientId = req.params.PatientId;

    try {
      const onlineUsers = await fetchOnlineUsers(patientId, headerUserId);
      const output = { data: onlineUsers, message: "success" };
      return res.status(200).json(output);
    } catch (error) {
      const output = {
        data: { message: "An error occurred while fetching online users." },
      };
      return res.status(500).json(output);
    }
  } else {
    const output = { data: { message: "INVALID_CREDENTIALS" } };
    return res.status(403).json(output);
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
      //     user_id: headerUserId,
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
        created: new Date().toISOString().replace("T", " ").replace("Z", " "),
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
        //       { last_updated: new Date().toISOString().replace("T"," ").replace("Z"," ") },
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
          //   { scans_needed: "1", last_updated: new Date().toISOString().replace("T"," ").replace("Z"," ") },
          //   { id: data["patient_id"] }
          // );
          await executeQuery(
            `UPDATE patients SET scans_needed=?,last_updated=NOW() WHERE id=?`,
            [data["patient_id"]]
          );
          //         this.ci.db.update(
          //           "user_patients",
          //           { last_updated: new Date().toISOString().replace("T"," ").replace("Z"," ") },
          //           { patient_id: data["patient_id"] }
          //         );
          //       }
          //     }

          //     // Global Status
          const updateData = {
            user_id: headerUserId,
            patient_id: data["patient_id"],
            update_type: "status_update",
            url:
              "snetchd://strokenetchandigarh.com/patient_analysis/" +
              data["patient_id"] +
              "/status",
            last_updated: new Date()
              .toISOString()
              .replace("T", " ")
              .replace("Z", " "),
          };
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

const getConclusionTypes = async (req, res) => {
  try {
    const headerUserId = req.headers.userid;
    const headerUserToken = req.headers.usertoken;

    if (ValidateUser(headerUserId, headerUserToken)) {
      const patientId = req.params.patientId;
      const finalArray = {};

      const checkIfExpiredOutomeExists = await executeQuery(
        "SELECT * FROM conclusion_outcomes WHERE patient_id = ? AND conclusion_type = 'Outcome' AND conclusion_value = 'Expired'",
        [patientId]
      );

      const checkIfDischargedOutomeExists = await executeQuery(
        "SELECT * FROM conclusion_outcomes WHERE patient_id = ? AND conclusion_type = 'Outcome' AND conclusion_value = 'Discharge'",
        [patientId]
      );

      const checkIfLAMAOutomeExists = await executeQuery(
        "SELECT * FROM conclusion_outcomes WHERE patient_id = ? AND conclusion_type = 'Outcome' AND conclusion_value = 'LAMA'",
        [patientId]
      );

      let types;
      let getConclustionTypes;
      const allTypes = {};

      if (checkIfExpiredOutomeExists.length > 0) {
        types = [];
        getConclustionTypes = [];
        finalArray["patient_discharged"] = true;
        finalArray["patient_expired"] = true;
      } else if (checkIfDischargedOutomeExists.length > 0) {
        finalArray["patient_discharged"] = true;

        getConclustionTypes = await executeQuery(
          "SELECT * FROM conclusion_types WHERE id = 11",
          []
        );

        for (const val of getConclustionTypes) {
          if (finalArray["patient_discharged"]) {
            if (!allTypes[val["type"]]) {
              allTypes[val["type"]] = [];
            }
            allTypes[val["type"]].push(val);
          }
        }

        types = Object.keys(allTypes);
      } else if (checkIfLAMAOutomeExists.length > 0) {
        finalArray["patient_onLAMA"] = true;

        getConclustionTypes = await executeQuery(
          "SELECT * FROM conclusion_types WHERE id = 11",
          []
        );

        for (const val of getConclustionTypes) {
          if (finalArray["patient_discharged"]) {
            if (!allTypes[val["type"]]) {
              allTypes[val["type"]] = [];
            }
            allTypes[val["type"]].push(val);
          }
        }

        types = Object.keys(allTypes);
      } else {
        finalArray["patient_discharged"] = false;
        finalArray["patient_expired"] = false;
        finalArray["patient_onLAMA"] = false;

        getConclustionTypes = await executeQuery(
          "SELECT * FROM conclusion_types",
          []
        );

        for (const val of getConclustionTypes) {
          if (finalArray["patient_discharged"]) {
            if (!allTypes[val["type"]]) {
              allTypes[val["type"]] = [];
            }
            allTypes[val["type"]].push(val);
          }
        }

        types = Object.keys(allTypes);
      }

      const patient_conclusion_outcomes = await executeQuery(
        "SELECT conclusion_type, conclusion_value, created, user_name FROM conclusion_outcomes_view WHERE patient_id = ? ORDER BY id DESC",
        [patientId]
      );

      for (const val of patient_conclusion_outcomes) {
        val["date"] = new Date(val["created"]).toLocaleDateString();
        val["time"] = new Date(val["created"]).toLocaleTimeString();
      }

      finalArray["types"] = types;
      finalArray["values"] = getConclustionTypes;
      finalArray["outcomes"] = patient_conclusion_outcomes;

      res.status(200).json({ data: finalArray });
    } else {
      es.status(400).json({ data: { message: "INVALID_CREDENTIALS" } });
    }
  } catch (error) {
    console.error("Error: ", error);
    res.status(403).json(error);
  }
};

const postConclusion = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if (ValidateUser(headerUserId, headerUserToken)) {
    const data = req.body;
    const errors = [];
    if (!data["patient_id"] || data["patient_id"] === "") {
      errors.push("patient_id is required");
    }
    if (!data["conclusion_type"] || data["conclusion_type"] === "") {
      errors.push("conclusion_type is required");
    }
    if (!data["conclusion_value"] || data["conclusion_value"] === "") {
      errors.push("conclusion_value is required");
    }

    if (errors.length > 0) {
      const output = { data: { message: errors[0] } };
      res.status(403).json(output);
    } else {
      const insertConclusionData = {
        user_id: headerUserId,
        patient_id: data["patient_id"],
        conclusion_type: data["conclusion_type"],
        conclusion_value: data["conclusion_value"],
        created: new Date().toISOString().replace("T", " ").replace("Z", " "),
      };

      const query =
        "INSERT INTO conclusion_outcomes (user_id, patient_id, conclusion_type, conclusion_value, created) VALUES (?, ?, ?, ?, ?)";
      const params = [
        insertConclusionData["user_id"],
        insertConclusionData["patient_id"],
        insertConclusionData["conclusion_type"],
        insertConclusionData["conclusion_value"],
        insertConclusionData["created"],
      ];

      try {
        await executeQuery(query, params);

        // // Close all the conversations where any conclusion outcome happens
        // const updateQuery =
        //   "UPDATE conversations SET conversation_closed = '1' WHERE patient_id = ?";
        // await executeQuery(updateQuery, [data["patient_id"]]);

        // Update Last Updated
        const updatePatientsQuery =
          "UPDATE patients SET last_updated = ? WHERE id = ?";
        await executeQuery(updatePatientsQuery, [
          new Date().toISOString().replace("T", " ").replace("Z", " "),
          data["patient_id"],
        ]);

        const updateUserPatientsQuery =
          "UPDATE user_patients SET last_updated = ? WHERE patient_id = ?";
        await executeQuery(updateUserPatientsQuery, [
          new Date().toISOString().replace("T", " ").replace("Z", " "),
          data["patient_id"],
        ]);

        // Global Status
        const updateData = {
          user_id: headerUserId,
          patient_id: data["patient_id"],
          update_type: "status_update",
          url: `snetchd://strokenetchandigarh.com/patient_analysis/${data["patient_id"]}/status`,
          last_updated: new Date()
            .toISOString()
            .replace("T", " ")
            .replace("Z", " "),
        };
        updatePatientStatus(updateData);

        const output = {
          data: { message: "Status was updated successfully." },
        };
        res.status(200).json(output);
      } catch (error) {
        console.log(error);
        const output = {
          data: { message: "Problem posting your status. Please try again." },
        };
        res.status(400).json(output);
      }
    }
  } else {
    const output = { data: { message: "INVALID_CREDENTIALS" } };
    res.status(403).json(output);
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

module.exports = {
  postTransitionStatus,
  postComment,
  getComments,
  getTransitionStatuses,
  getConclusionTypes,
  postConclusion,
  getOnlineUsers
};
