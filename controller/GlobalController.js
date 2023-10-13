const getCenters = (req, res) => {
  const centers = [
    { center_name: "PGI", id: "123" },
    { center_name: "PGI2", id: "133", main_hub: "123" },
    { center_name: "PGI", id: "125" },
  ];
  res.status(200).send({ data: centers });
};

const getHubs = (req, res) => {
  const hubs = [
    { center_name: "PGI", id: "123" },
    { center_name: "PGI", id: "123" },
    { center_name: "PGI", id: "123" },
  ];
  res.status(200).send({ data: hubs });
};

const globalSettings = (req, res) => {
  const globalSettings = {
    departments: [
      {
        name: "Neurology",
        value: "neurology",
        roles: [
          { name: "Physician", value: "physician" },
          { name: "Senior Resident", value: "senior_resident" },
          { name: "Emergency Resident", value: "emergency_resident" },
          { name: "Stroke Nurse", value: "stroke_nurse" },
        ],
      },
      {
        name: "Emergency",
        value: "emergency",
        roles: [
          { name: "Physician", value: "physician" },
          { name: "Senior Resident", value: "senior_resident" },
          { name: "Emergency Resident", value: "emergency_resident" },
        ],
      },
      // Add other departments and roles as needed
    ],
  };

  const output = {
    status: "success",
    data: globalSettings,
  };

  res.status(200).json(output);
};

module.exports = { getCenters, getHubs, globalSettings };
