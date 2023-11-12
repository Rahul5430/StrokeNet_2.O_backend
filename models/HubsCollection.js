const mongoose = require("mongoose");

const hubSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
    },
    center_name: {
      type: String,
    },
    short_name: {
      type: String,
    },
    center_location: {
      type: String,
    },
    contact_number: {
      type: Number,
    },
    is_hub: {
      type: String,
    },
    is_spoke: {
      type: String,
    },
    is_center: {
      type: String,
    },
    main_hub: {
      type: String,
    },
    status: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Hubs = mongoose.model("HubsCollection", hubSchema);

module.exports = Hubs;