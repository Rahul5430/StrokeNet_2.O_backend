const Page = require("../models/PageCollection");

const getCenters = (req, res) => {
  // const centers = [
  //   { center_name: "PGI", id: "123" },
  //   { center_name: "PGI2", id: "133", main_hub: "123" },
  //   { center_name: "PGI", id: "125" },
  // ];
  const centers = [
    {
      id: "2",
      center_name: "PGIMER Emergency",
      short_name: "PGI12CH",
      center_location: "Chandigarh",
      contact_number: null,
      is_hub: "yes",
      is_spoke: "no",
      is_center: "no",
      main_hub: null,
      status: "1",
      created: "2019-03-18 15:05:13",
    },
    {
      id: "3",
      center_name: "SEC-32 Emergency",
      short_name: "GM32CH",
      center_location: "Chandigarh",
      contact_number: null,
      is_hub: "no",
      is_spoke: "yes",
      is_center: "no",
      main_hub: "2",
      status: "1",
      created: "2019-06-20 16:32:55",
    },
    {
      id: "4",
      center_name: "SEC-16 Emergency",
      short_name: "GMSH16",
      center_location: "Chandigarh",
      contact_number: null,
      is_hub: "no",
      is_spoke: "yes",
      is_center: "no",
      main_hub: "2",
      status: "1",
      created: "2019-06-20 16:36:11",
    },
    {
      id: "5",
      center_name: "SEC-22 Civil Hospital ",
      short_name: "CH22CH",
      center_location: "Chandigarh",
      contact_number: null,
      is_hub: "no",
      is_spoke: "yes",
      is_center: "no",
      main_hub: "2",
      status: "1",
      created: "2021-07-04 08:56:00",
    },
    {
      id: "6",
      center_name: "SEC-45 Civil Hospital ",
      short_name: "CH45CH",
      center_location: "Chandigarh",
      contact_number: null,
      is_hub: "no",
      is_spoke: "yes",
      is_center: "no",
      main_hub: "2",
      status: "1",
      created: "2021-07-04 09:52:00",
    },
    {
      id: "7",
      center_name: "Civil Hospital Manimajra",
      short_name: "CHMNMJRA",
      center_location: "Manimajra",
      contact_number: null,
      is_hub: "no",
      is_spoke: "yes",
      is_center: "no",
      main_hub: "2",
      status: "1",
      created: "2021-07-04 09:52:00",
    },
    {
      id: "8",
      center_name: "Jalandhar Hospital",
      short_name: "JAL12J",
      center_location: "Jalandhar ",
      contact_number: null,
      is_hub: "yes",
      is_spoke: "no",
      is_center: "no",
      main_hub: null,
      status: "1",
      created: "2019-03-18 15:05:13",
    },
  ];
  res.status(200).send({ data: centers });
};

const getHubs = (req, res) => {
  // const hubs = [
  //   { center_name: "PGI", id: "123" },
  //   { center_name: "PGI", id: "13" },
  //   { center_name: "PGI", id: "1723" },
  // ];
  const hubs = [
    {
      id: "2",
      center_name: "PGIMER Emergency",
      short_name: "PGI12CH",
      center_location: "Chandigarh",
      contact_number: null,
      is_hub: "yes",
      is_spoke: "no",
      is_center: "no",
      main_hub: null,
      status: "1",
      created: "2019-03-18 15:05:13",
    },
    {
      id: "8",
      center_name: "Jalandhar Hospital",
      short_name: "JAL12J",
      center_location: "Jalandhar ",
      contact_number: null,
      is_hub: "yes",
      is_spoke: "no",
      is_center: "no",
      main_hub: null,
      status: "1",
      created: "2019-03-18 15:05:13",
    },
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
      {
        name: "Radio Diagnosis",
        value: "radio_diagnosis",
        roles: [
          { name: "Physician", value: "physician" },
          { name: "Senior Resident", value: "senior_resident" },
          { name: "Emergency Resident", value: "emergency_resident" },
        ],
      },
      {
        name: "Internal Medicine",
        value: "internal_medicine",
        roles: [
          { name: "Physician", value: "physician" },
          { name: "Senior Resident", value: "senior_resident" },
          { name: "Emergency Resident", value: "emergency_resident" },
        ],
      },
      {
        name: "COVID",
        value: "covid",
        roles: [
          { name: "Consultant", value: "consultant" },
          { name: "Senior Resident", value: "senior_resident" },
          { name: "Junior Resident", value: "junior_resident" },
        ],
      },
      {
        name: "PRM",
        value: "prm",
        roles: [
          { name: "Physiatrist", value: "physiatrist" },
          { name: "Physiotherapist", value: "physiotherapist" },
          { name: "Occupational Therapist", value: "occupational_therapist" },
          { name: "Student / Resident", value: "student/resident" },
        ],
      },
    ],
  };

  const output = {
    status: "success",
    data: globalSettings,
  };

  res.status(200).json(output);
};

const getSinglePage = async (req, res) => {
  const pageId = req.params.pageId;
  const PageContent = await Page.findOne({ id: pageId });
  res.status(200).send({ data: PageContent });
};

const uploadFile = async (req, res) => {
  const fileName = req.file?.filename;
  res.status(200).json(fileName);
};

module.exports = {
  getCenters,
  getHubs,
  globalSettings,
  getSinglePage,
  uploadFile,
};
