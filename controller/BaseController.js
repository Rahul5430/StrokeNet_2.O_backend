const admin = require("firebase-admin");
const socketIo = require("socket.io");
const { executeQuery } = require("../config/sqlDatabase");
const nodemailer = require("nodemailer");

const markPatientChecked = async (patientId, userId) => {
  try {
    // Get last patient update
    const getLastPatientUpdateQuery = `
          SELECT * FROM patient_updates 
          WHERE patient_id = ? 
          ORDER BY id DESC 
          LIMIT 1`;
    const lastPatientUpdate = await executeQuery(getLastPatientUpdateQuery, [
      patientId,
    ]);

    if (lastPatientUpdate) {
      const lastUpdateId = lastPatientUpdate[0].id;

      // Check if patient has been checked
      const getCheckedPatientQuery = `
              SELECT * FROM patient_last_viewed 
              WHERE user_id = ? AND patient_id = ?`;
      const checkedPatient = await executeQuery(getCheckedPatientQuery, [
        userId,
        patientId,
      ]);

      // if (checkedPatient) {
      //   // Update existing record
      //   const updateCheckedPatientQuery = `
      //             UPDATE patient_last_viewed 
      //             SET last_update_id = ?, last_checked = CURRENT_TIMESTAMP 
      //             WHERE id = ?`;
      //   await executeQuery(updateCheckedPatientQuery, [
      //     lastUpdateId,
      //     checkedPatient[0].patient_id,
      //   ]);
      // } else {
      //   // Insert new record
      //   const insertCheckedPatientQuery = `
      //             INSERT INTO patient_last_viewed (patient_id, user_id, last_update_id, last_checked) 
      //             VALUES (?, ?, ?, CURRENT_TIMESTAMP)`;
      //   await executeQuery(insertCheckedPatientQuery, [
      //     patientId,
      //     userId,
      //     lastUpdateId,
      //   ]);
      // }
    }
  } catch (error) {
    console.error("An error occurred:", error);
    throw error; // Handle or rethrow the error as needed
  }
};

const updatePatientStatus = async (data) => {
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
    console.error("Error updating patient status:", error);
    throw error; // Forward the error to the caller
  }
};

async function patientCheckedbyUser(patientId, userId, patientlastUpdated) {
  const [lastPatientUpdateRows] = await executeQuery(
    "SELECT * FROM patient_updates WHERE patient_id = ? ORDER BY id DESC LIMIT 1",
    [patientId]
  );

  let patientChecked = false;

  if (lastPatientUpdateRows) {
    const lastPatientUpdate = lastPatientUpdateRows;

    // Check if the patient has been checked by the user
    const checkedPatientRows = await executeQuery(
      "SELECT * FROM patient_last_viewed WHERE user_id = ? AND patient_id = ? AND last_update_id = ?",
      [userId, patientId, lastPatientUpdate.id]
    );

    patientChecked = checkedPatientRows.length > 0;
  } else {
    // If there are no patient updates, consider the patient as checked
    patientChecked = true;
  }

  return patientChecked;
}

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
      // const patient = await getPatientDetails(data.id);
      // socket.broadcast.to(data.id).emit("PatientUpdated", patient);
      // if (data.type && data.type == "uploads") {
      //   const filestab = patient.patient_files[data.tab];
      //   socket.broadcast
      //     .to(data.id + "-uploads-" + data.tab)
      //     .emit("FileUploaded", filestab);
      // }
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
          patientId: data.patientId.toString(),
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
  patientCheckedbyUser
};
