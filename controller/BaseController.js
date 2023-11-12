const admin = require("firebase-admin");
const serviceAccount = require("../google-secrets.json");
const Patient = require("../models/PatientCollection");
const User = require("../models/UserCollection");
const socketIo = require("socket.io");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

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
      console.log(num);
    });

    // socket.on("FileUpload", async(data) => {
    //   const patient = await Patient.findById(data.id);
    //   const filestab = patient.patient_files[data.tab];
    //   console.log(filestab);
    // });

    socket.on("comment_push", (data) => {
      console.log(data);
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
      // console.log(num);
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
      const patient = await Patient.findById(data.id);
      socket.broadcast.to(data.id).emit("PatientUpdated", patient);
      if (data.type && data.type == "uploads") {
        const filestab = patient.patient_files[data.tab];
        socket.broadcast
          .to(data.id + "-uploads-" + data.tab)
          .emit("FileUploaded", filestab);
      }
    });

    socket.on("setChatUserId", (data) => {
      socket.join(data.senderId);
      io.to(data.recieverId).emit("joined");
      const number = io.sockets.adapter.rooms.get(data.recieverId);
      const num = number ? number.size : 0;
      console.log(num);
      if (num) {
        io.to(data.senderId).emit("joined");
      }
    });

    socket.on("setUserId", (data) => {
      socket.join(data);
    });

    socket.on("sendMessage", async (data) => {
      const message = data.message;
      io.to(message.recieverId).emit("message", message);
      console.log(message);
      const number = io.sockets.adapter.rooms.get(message.recieverId);
      const num = number ? number.size : 0;
      if (num == 0) {
        const user = await User.findById(message.recieverId);
        if (user && user.fcm_userid) {
          sendNotification(user.fcm_userid, "chat", data);
        }
      }
      io.to(message.senderId).emit("sent");
    });
  });
};

const sendNotification = (registrationToken, reason, data = {}) => {
  console.log(reason);
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
  } else if (reason == "userAdded") {
    console.log(data);
    message = {
      notification: {
        title: "Admin",
        body: `New User added having name ${data.name} and ${data.phone_number} phone number`,
      },
      android: {
        notification: {
          title: "Notification For Andorid",
          body: "New User Registered In StrokeNet",
          sound: "codestrokeactivated.mp3",
        },
      },
      data:{
        redirect:'manage-users',
      },
      token: registrationToken,
    };
    // console.log(message);
  } else {
    console.log(data);
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
      // console.log("Successfully sent message:", response);
    })
    .catch((error) => {
      console.error("Error sending message:", error);
    });
  // }, 2000);
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

module.exports = {
  FormattedDate,
  calculateAge,
  sendNotification,
  connectToSocket,
};
