const mongoose = require('mongoose');
require('mongoose-type-email');

const centerIdSchmea = new mongoose.Schema({
    "id": {
        type: Number
    },
    "center_name": {
        type: String
    },
    "short_name": {
        type: String
    },
    "center_location": {
        type: String
    },
    "contact_number": {
        type: Number
    },
    "is_hub": {
        type: String
    },
    "is_spoke": {
        type: String
    },
    "is_center": {
        type: String
    },
    "main_hub": {
        type: String
    },
    "status": {
        type: String
    },
},{
    timestamps: true
});

const userSchema = new mongoose.Schema({
    "user_id": {
        type: String
    },
    "first_name": {
        type: String
    },
    "last_name": {
        type: String
    },
    "fullname": {
        type: String
    },
    "email_address": {
        type: mongoose.SchemaTypes.Email
    },
    "phone_number": {
        type: String
    },
    "phone_number_verified": {
        type: String
    },
    "user_department": {
        type: String
    },
    "user_role": {
        type: String
    },
    "center_id": {
        type: [centerIdSchmea]
    },
    "onesignal_userid": {
        type: String
    },
    "status": {
        type: String
    },
    "online_status": {
        type: String
    },
    "chat_notifications": {
        type: String
    },
    "token": {
        type: String
    },
    "token_expire": {
        type: String
    },
    "ip": {
        type: String
    },
    "last_login": {
        type: String
    },
    "user_department_raw": {
        type: String
    },
    "user_role_raw": {
        type: String
    },
    "is_hub_user": {
        type: Boolean
    },
    "is_spoke_user": {
        type: Boolean
    },
    "is_center_user": {
        type: Boolean
    }
});

const User = mongoose.model('UserCollection',userSchema);

module.exports = User;