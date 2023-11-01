const admin = require("firebase-admin");
const serviceAccount = require("../google-secrets.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

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
          title:"Notification For Andorid",
          body:"You Logged In StrokeNet",
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
        sound: "CODE_STROKE_ACTIVATED.mp3",
      },
      android: {},
      data: {
        name: "Nitin",
      },
      token: registrationToken,
    };
  } else {
    message = {
      notification: {
        title: "Congratulations",
        body: "Notification Recieved",
      },
      android: {},
      data: {
        name: "Nitin",
      },
      token: registrationToken,
    };
  }
  setTimeout(() => {
    admin
      .messaging()
      .send(message)
      .then((response) => {
        console.log("Successfully sent message:", response);
      })
      .catch((error) => {
        console.error("Error sending message:", error);
      });
  }, 2000);
  // Send the message to the devices
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
};
