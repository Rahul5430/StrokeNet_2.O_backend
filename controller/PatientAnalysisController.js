const Patient = require("../models/PatientCollection");
const User = require("../models/UserCollection");

const postTransitionStatus = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if ((headerUserId, headerUserToken)) {
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

      const getUserCenterId = await User.findById(headerUserId);

      const insertStatusData = {
        user_id: headerUserId,
        patient_id: data["patient_id"],
        status_id: data["status_id"],
        center_id: getUserCenterId.center_id,
        created: new Date().toISOString(),
      };

      const patient = await Patient.findById(data.patient_id);
      patient.transition_statuses = insertStatusData;
      patient.last_updated = Date.now();

      await patient.save();

      //   const insertStatus = this.ci.db.insert(
      //     "transition_statuses",
      //     insertStatusData
      //   );

      //   if (insertStatus) {
      //     // Update Last Updated
      //     this.ci.db.update(
      //       "patients",
      //       { last_updated: new Date().toISOString() },
      //       { id: data["patient_id"] }
      //     );
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
      //     const getStatusInfo = this.ci.db.get("status_types", ["title"], {
      //       id: data["status_id"],
      //     });

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
      //     if (
      //       data["status_id"] === "3" ||
      //       data["status_id"] === "5" ||
      //       data["status_id"] === "20"
      //     ) {
      //       const getRadioPushIDs = getOneSignalIdsOfTheRadioDiagnosisUsers(
      //         data["patient_id"]
      //       );

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
      //         this.ci.db.update(
      //           "patients",
      //           { scans_needed: "1", last_updated: new Date().toISOString() },
      //           { id: data["patient_id"] }
      //         );
      //         this.ci.db.update(
      //           "user_patients",
      //           { last_updated: new Date().toISOString() },
      //           { patient_id: data["patient_id"] }
      //         );
      //       }
      //     }

      //     // Global Status
      //     const updateData = {
      //       user_id: headerUserId[0],
      //       patient_id: data["patient_id"],
      //       update_type: "status_update",
      //       url:
      //         "snetchd://strokenetchandigarh.com/patient_analysis/" +
      //         data["patient_id"] +
      //         "/status",
      //       last_updated: new Date().toISOString(),
      //     };

      //     updatePatientStatus(updateData);
      // Global Status

      const output = {
        data: {
          message: "Status was updated successfully.",
          // transition_statuses: fetchTransitionStatuses(data["patient_id"]),
        },
      };

      return res.status(200).json(output);
    }
    //  else {
    //     const output ={data: {
    //       message: "Problem posting your status. Please try again.",
    //     }};
    //     return res.json(output, 400);
    //   }
    // }
  } else {
    const output = {
      data: { message: "Problem posting your status. Please try again." },
    };
    return res.staus(403).json(output);
  }
};

const postComment = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if (headerUserToken && headerUserId) {
    const patientId = req.body.patientId;
    const patient = await Patient.findById(patientId);
    const user = await User.findById(headerUserId);
    const comments = patient.comments;
    const newMsg = {
      message: req.body.message,
      user_id: {
        fullname: user.fullname,
        user_id: user._id,
      },
      created: Date.now(),
    };
    comments.push(newMsg);
    patient.last_message = {
      last_message: newMsg.message,
      last_message_at: newMsg.created,
      user: {
        fullname: user.fullname,
        user_role: user.user_role,
      },
    };
    await patient.save();
    res.status(200).send(newMsg);
  } else {
    res.send(403).status("hello");
  }
};

const getComments = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;
  if (headerUserToken && headerUserId) {
    try {
      const patientId = req.params.PatientId;
      const patient = await Patient.findById(patientId);
      res.status(200).send({ data: patient.comments });
    } catch (err) {
      console.log(err);
      const output = { data: { message: "Something Went Wrong" } };
      res.status(403).send(output);
    }
  } else {
  }
};

module.exports = { postTransitionStatus, postComment, getComments };
