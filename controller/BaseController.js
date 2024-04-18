const admin = require("firebase-admin");
const socketIo = require("socket.io");
const {executeQuery} = require("../config/sqlDatabase");
const nodemailer = require("nodemailer");

const markPatientChecked = async (patientId, userId) => {
  try {
      // Get last patient update
      const getLastPatientUpdateQuery = `
          SELECT * FROM patient_updates 
          WHERE patient_id = ? 
          ORDER BY id DESC 
          LIMIT 1`;
      const lastPatientUpdate = await executeQuery(getLastPatientUpdateQuery, [patientId]);

      if (lastPatientUpdate.length > 0) {
          const lastUpdateId = lastPatientUpdate[0].id;

          // Check if patient has been checked
          const getCheckedPatientQuery = `
              SELECT * FROM patient_last_viewed 
              WHERE user_id = ? AND patient_id = ?`;
          const checkedPatient = await executeQuery(getCheckedPatientQuery, [userId, patientId]);

          if (checkedPatient.length > 0) {
              // Update existing record
              const updateCheckedPatientQuery = `
                  UPDATE patient_last_viewed 
                  SET last_update_id = ?, last_checked = CURRENT_TIMESTAMP 
                  WHERE id = ?`;
              await executeQuery(updateCheckedPatientQuery, [lastUpdateId, checkedPatient[0].id]);
          } else {
              // Insert new record
              const insertCheckedPatientQuery = `
                  INSERT INTO patient_last_viewed (patient_id, user_id, last_update_id, last_checked) 
                  VALUES (?, ?, ?, CURRENT_TIMESTAMP)`;
              await executeQuery(insertCheckedPatientQuery, [patientId, userId, lastUpdateId]);
          }
      }
  } catch (error) {
      console.error("An error occurred:", error);
      throw error; // Handle or rethrow the error as needed
  }
};


const updatePatientStatus = async(data) => {
  try {
      // Insert data into patient_updates table
      await executeQuery(
          `INSERT INTO patient_updates (patient_id, user_id, update_type, url)
           VALUES (?, ?, ?, ?)`,
          [data.patient_id, data.user_id, data.update_type, data.url]
      );

      // Mark patient as checked
      await markPatientChecked(data.patient_id, data.user_id);
  } catch (error) {
      console.error('Error updating patient status:', error);
      throw error; // Forward the error to the caller
  }
}

const getPatientDetails = async (patientID) => {
  // Get the information of the patient
  const [patient] = await executeQuery("SELECT * FROM Patients WHERE id = ?", [
    patientID,
  ]);
  if (!patient) {
    return null;
  }
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

  const fetchPatientContradictionsQuery = `SELECT * FROM patient_contradictions WHERE patient_id = ${patientID}`;
  const [patientContradictionsData] = await executeQuery(
    fetchPatientContradictionsQuery
  );

  patient.patient_contradictions = patientContradictionsData;

  const user_data_query = `select id as user_id, fullname, phone_number from usercollection where id=?`;
  const user_data = await executeQuery(user_data_query, [patient.created_by]);
  patient.user_data = user_data;
  console.log(user_data);

  const fetchPatientScanTimesQuery = `SELECT * FROM patient_scan_times where patient_id = ${patientID}`;
  const [patientScanTimes] = await executeQuery(fetchPatientScanTimesQuery);
  patient.patient_scan_times = patientScanTimes;

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
  const currentTime = new Date();

    // Fetch transition statuses with specific status IDs and order them by ID in descending order, take the first one
    const transitionStatusQuery = `
        SELECT created, id, status_id, title 
        FROM transition_statuses_view 
        WHERE patient_id = ? AND status_id IN (1, 2, 19) 
        ORDER BY id DESC 
        LIMIT 1`;
    const transitionStatuses = await executeQuery(transitionStatusQuery, [patientID]);

    if (transitionStatuses.length > 0) {
        const { created } = transitionStatuses[0];
        const fortyFiveMinsLater = new Date(new Date(created).getTime() + 45 * 60000);
        patient.show_decrement_timer = currentTime > new Date(created) && currentTime < fortyFiveMinsLater;
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
        const diffMinutes = Math.floor((diff % (3600 * 1000)) / (60000));
        const diffSeconds = Math.floor((diff % (60000)) / 1000);

        let timeComponents = [];
        if (diffDays > 0) timeComponents.push(`${diffDays}d`);
        if (diffHours > 0) timeComponents.push(`${diffHours}h`);
        if (diffMinutes > 0) timeComponents.push(`${diffMinutes}m`);
        if (diffSeconds > 0) timeComponents.push(`${diffSeconds}s`);

        patient.show_increment_timer = false;
        patient.show_tfso_total_time_message_box = true;
        patient.show_total_time_taken_from_entry = timeComponents.join(" : ");
    }


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

const connectToSocket = (server) => {
  const io = socketIo(server, { cors: {} });
  io.on("connection", (socket) => {
    socket.on("disconnect", function () {});

    socket.on("PatientRoom", (patientId) => {
      socket.join(patientId);
      const number = io.sockets.adapter.rooms.get(patientId);
      const num = number ? number.size : 0;
      io.to(patientId).emit("UserStatus", {
        event: "Joined",
        number: num,
      });
    });

    socket.on("joinUploadsRoom", (data) => {
      socket.join(data.patientId + "-uploads-" + data.tab);
      const number = io.sockets.adapter.rooms.get(
        data.patientId + "-uploads-" + data.tab
      );
      const num = number ? number.size : 0;
    });

    socket.on("joinPatientChatRoom", (data) => {
      socket.join(data.patientId + "_chat");
      const number = io.sockets.adapter.rooms.get(data.patientId + "_chat");
      const num = number ? number.size : 0;
      // console.log(num);
    });

    // socket.on("FileUpload", async(data) => {
    //   const patient = await Patient.findById(data.id);
    //   const filestab = patient.patient_files[data.tab];
    //   console.log(filestab);
    // });

    socket.on("comment_push", (data) => {
      // console.log(data);
      socket.broadcast
        .to(data.patientId + "_chat")
        .emit("comment_pushed", data.message);
    });

    socket.on("UploadsRoomLeft", (data) => {
      socket.leave(data.patientId + "-uploads-" + data.tab);
    });

    socket.on("PatientChatRoomLeft", (data) => {
      const number = io.sockets.adapter.rooms.get(data.patientId + "_chat");
      const num = number ? number.size : 0;
      socket.leave(data.patientId + "_chat");
    });

    socket.on("PatientRoomLeft", (patientId) => {
      socket.leave(patientId);
      const number = io.sockets.adapter.rooms.get(patientId);
      const num = number ? number.size : 0;
      io.to(patientId).emit("UserStatus", {
        event: "Left",
        number: num,
      });
    });

    socket.on("PatientUpdate", async (data) => {
      const patient = await getPatientDetails(data.id);
      socket.broadcast.to(data.id).emit("PatientUpdated", patient);
      if (data.type && data.type == "uploads") {
        const filestab = patient.patient_files[data.tab];
        socket.broadcast
          .to(data.id + "-uploads-" + data.tab)
          .emit("FileUploaded", filestab);
      }
    });

    socket.on("setChatUserId", async (data) => {
      socket.join(data.senderId);
      io.to(data.recieverId).emit("joined");
      io.to(data.recieverId).emit("messageSeen");
      const number = io.sockets.adapter.rooms.get(data.recieverId);
      const num = number ? number.size : 0;
      if (num) {
        io.to(data.senderId).emit("joined");
      }
    });

    socket.on("UnsetChatUserId", (data) => {
      socket.leave(data.senderId);
    });

    socket.on("setUserId", (data) => {
      socket.join(data);
    });

    socket.on("sendMessage", async (data) => {
      console.log(data);
      const message = data.message;
      io.to(message.recieverId).emit("message", message);
      const number = io.sockets.adapter.rooms.get(message.recieverId);
      const num = number ? number.size : 0;
      // console.log(num);
      if (num == 0) {
        const getUserQuery = `
        SELECT
          *
        FROM UserCollection u
        WHERE u.id = ?
      `;
        const getUserData = [message.recieverId];
        const user = await executeQuery(getUserQuery, getUserData);
        if (user && user[0] && user[0].fcm_userid) {
          sendNotification(user[0].fcm_userid, "chat", data);
        }
      } else {
        const updateMessagesQuery = `
        UPDATE Conversation
        SET read_by_user = true
        WHERE senderId = ? AND recieverId = ? AND read_by_user = false
      `;
        const updateMessagesData = [message.senderId, message.recieverId];
        await executeQuery(updateMessagesQuery, updateMessagesData);
        io.to(message.senderId).emit("messageSeen");
      }
      io.to(message.senderId).emit("sent");
    });
  });
};

const sendNotification = (registrationToken, reason, data = {}) => {
  console.log(data);
  try {
    let message;
    if (reason == "LoggedIn") {
      message = {
        notification: {
          title: "Congratulations",
          body: "You Logged In",
        },
        android: {
          notification: {
            title: "Notification For Andorid",
            body: "You Logged In StrokeNet",
            sound: "codestrokeactivated.mp3",
            // imageUrl:"https://strokenet.onrender.com/files/1698494179874-1000072138.jpg"
          },
        },
        token: registrationToken,
      };
      // console.log(message);
    } else if (reason == "contactUs") {
      console.log(registrationToken);
      message = {
        notification: {
          title: `You recieved message from ${data.name}`,
          body: data.message,
        },
        // android: {
        //   notification: {
        //     title: "Notification For Andorid",
        //     body: "You Logged In StrokeNet",
        //   },
        // },
        token: registrationToken,
      };
      console.log(data);
    } else if (reason == "codeStrokeAlert") {
      const getCenterInfo = data.getCenterInfo;
      console.log(data);
      message = {
        notification: {
          title: "Code Stroke",
          body: `Acute Stroke in ${getCenterInfo.center_name}`,
        },
        android: {
          notification: {
            title: "Code Stroke",
            body: `Acute Stroke in ${getCenterInfo.center_name}`,
            channel_id: "codeStrokeAlert",
          },
        },
        data: {
          redirect: "patient-details",
          patientId: (data.patientId).toString(),
        },
        token: registrationToken,
      };
    } else if (reason == "userAdded") {
      // console.log(data);
      message = {
        notification: {
          title: "New User added",
          body: `Name - ${data.name} and Phone number - ${data.phone_number} `,
        },
        android: {
          notification: {
            title: "New User added",
            body: `Name - ${data.name} and Phone number - ${data.phone_number}`,
            sound: "codestrokeactivated.mp3",
          },
        },
        data: {
          redirect: "manage-users",
        },
        token: registrationToken,
      };
      // console.log(message);
    } else {
      // console.log(data);
      message = {
        notification: {
          title: data.name,
          body: data.message.message,
        },
        data: {
          redirect: "chat",
          fullname: data.name,
          userId: data.message.senderId,
        },
        token: registrationToken,
      };
    }
    // setTimeout(() => {
    admin
      .messaging()
      .send(message)
      .then((response) => {
        console.log("Successfully sent message:", response);
      })
      .catch((error) => {
        console.error("Error sending message:", error);
      });
    // }, 2000);
  } catch (err) {
    console.log(err);
  }
};

const FormattedDate = (isoDateTime) => {
  if (isoDateTime == "" || isoDateTime == undefined) return isoDateTime;
  const date = new Date(isoDateTime);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const formattedDateTime = `${day}:${month}:${year} ${hours}:${minutes}`;
  return formattedDateTime;
};

const calculateAge = (dateOfBirth) => {
  const dob = new Date(dateOfBirth);
  const today = new Date();

  const dobYear = dob.getFullYear();
  const todayYear = today.getFullYear();

  let age = todayYear - dobYear;

  const dobMonth = dob.getMonth();
  const todayMonth = today.getMonth();

  if (todayMonth < dobMonth) {
    age--;
  } else if (todayMonth === dobMonth) {
    const dobDay = dob.getDate();
    const todayDay = today.getDate();
    if (todayDay < dobDay) {
      age--;
    }
  }

  return age;
};

const validateEmail = (email) => {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailRegex.test(email);
};

const sendemail = async (email, message) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.OWNER_EMAIL,
      pass: process.env.OWNER_PASS,
    },
  });
  const mailOptions = {
    from: process.env.OWNER_EMAIL,
    to: email,
    subject: "StrokeNet",
    text: `${message}`,
  };
  var sended = await transporter.sendMail(mailOptions);
  return sended;
};

module.exports = {
  FormattedDate,
  calculateAge,
  sendNotification,
  connectToSocket,
  validateEmail,
  sendemail,
  updatePatientStatus,
  getPatientDetails
};
