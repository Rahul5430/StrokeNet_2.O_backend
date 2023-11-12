const mongoose = require("mongoose");
require("mongoose-type-email");

const userSchema = new mongoose.Schema({
  admin: {
    type: Boolean,
    default: false,
  },
  user_id: {
    type: String,
  },
  first_name: {
    type: String,
  },
  last_name: {
    type: String,
  },
  fullname: {
    type: String,
  },
  email_address: {
    type: String,
  },
  password: {
    type: String,
  },
  phone_number: {
    type: String,
  },
  phone_number_verified: {
    type: Boolean,
  },
  user_department: {
    type: String,
  },
  user_role: {
    type: String,
  },
  center_id: {},
  fcm_userid: {
    type: String,
    default: "",
  },
  status: {
    type: String,
  },
  online_status: {
    type: Boolean,
    default: true,
  },
  chat_notifications: {
    type: String,
  },
  token: {
    type: String,
  },
  ip: {
    type: String,
  },
  last_login: {
    type: String,
  },
  user_department_raw: {
    type: String,
  },
  user_role_raw: {
    type: String,
  },
  is_hub_user: {
    type: Boolean,
  },
  is_spoke_user: {
    type: Boolean,
  },
  is_center_user: {
    type: Boolean,
  },
});

const User = mongoose.model("UserCollection", userSchema);

module.exports = User;
