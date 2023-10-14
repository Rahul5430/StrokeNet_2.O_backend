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
        ]
      },
      {
        name: "Emergency",
        value: "emergency",
        roles: [
          { name: "Physician", value: "physician" },
          { name: "Senior Resident", value: "senior_resident" },
          { name: "Emergency Resident", value: "emergency_resident" },
        ]
      },
      {
        name: "Radio Diagnosis",
        value: "radio_diagnosis",
        roles: [
          { name: "Physician", value: "physician" },
          { name: "Senior Resident", value: "senior_resident" },
          { name: "Emergency Resident", value: "emergency_resident" },
        ]
      },
      {
        name: "Internal Medicine",
        value: "internal_medicine",
        roles: [
          { name: "Physician", value: "physician" },
          { name: "Senior Resident", value: "senior_resident" },
          { name: "Emergency Resident", value: "emergency_resident" },
        ]
      },
      {
        name: "COVID",
        value: "covid",
        roles: [
          { name: "Consultant", value: "consultant" },
          { name: "Senior Resident", value: "senior_resident" },
          { name: "Junior Resident", value: "junior_resident" },
        ]
      },
      {
        name: "PRM",
        value: "prm",
        roles: [
          { name: "Physiatrist", value: "physiatrist" },
          { name: "Physiotherapist", value: "physiotherapist" },
          { name: "Occupational Therapist", value: "occupational_therapist" },
          { name: "Student / Resident", value: "student/resident" },
        ]
      }
    ]
  };

  const output = {
    status: "success",
    data: globalSettings,
  };

  res.status(200).json(output);
};

module.exports = { getCenters, getHubs, globalSettings };
