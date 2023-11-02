const admin = require("firebase-admin");
const serviceAccount = require("../google-secrets.json");
const Patient = require("../models/PatientCollection");
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

    // socket.on("FileUpload", async(data) => {
    //   const patient = await Patient.findById(data.id);
    //   const filestab = patient.patient_files[data.tab];
    //   console.log(filestab);
    // });

    socket.on("UploadsRoomLeft", (data) => {
      socket.leave(data.patientId + "-uploads-" + data.tab);
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

    socket.on("setUserName", (name) => {
      socket.username = name;
      io.emit("usersActivity", {
        user: name,
        event: "chatJoined",
      });
    });

    socket.on("sendMessage", (message) => {
      io.emit("message", {
        msg: message.text,
        user: socket.username,
        createdAt: new Date(),
      });
      console.log(message);
    });
  });
};

const sendNotification = (registrationToken, reason) => {
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
      data: {
        name: "Nitin",
      },
      token: registrationToken,
    };
    console.log(message);
  } else if (reason == "userAdded") {
    message = {
      notification: {
        title: "Admin",
        body: "New User added",
      },
      android: {
        notification: {
          title: "Notification For Andorid",
          body: "New User Registered In StrokeNet",
          sound: "CODE_STROKE_ACTIVATED.mp3",
        },
      },
      data: {
        name: "Nitin",
      },
      token: registrationToken,
    };
    console.log(message);
  } else {
    message = {
      notification: {
        title: "Congratulations",
        body: "Notification Recieved",
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
