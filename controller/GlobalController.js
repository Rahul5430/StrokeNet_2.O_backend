const { ValidateUser } = require("./authController");
const { sendNotification, sendemail } = require("./BaseController");
const {executeQuery} = require("../config/sqlDatabase");

const getCenters = async (req, res) => {
  // const centers = [
  //   {
  //     id: "2",
  //     center_name: "PGIMER Emergency",
  //     short_name: "PGI12CH",
  //     center_location: "Chandigarh",
  //     contact_number: null,
  //     is_hub: "yes",
  //     is_spoke: "no",
  //     is_center: "no",
  //     main_hub: null,
  //     status: "1",
  //     created: "2019-03-18 15:05:13",
  //   },
  //   {
  //     id: "3",
  //     center_name: "SEC-32 Emergency",
  //     short_name: "GM32CH",
  //     center_location: "Chandigarh",
  //     contact_number: null,
  //     is_hub: "no",
  //     is_spoke: "yes",
  //     is_center: "no",
  //     main_hub: "2",
  //     status: "1",
  //     created: "2019-06-20 16:32:55",
  //   },
  //   {
  //     id: "4",
  //     center_name: "SEC-16 Emergency",
  //     short_name: "GMSH16",
  //     center_location: "Chandigarh",
  //     contact_number: null,
  //     is_hub: "no",
  //     is_spoke: "yes",
  //     is_center: "no",
  //     main_hub: "2",
  //     status: "1",
  //     created: "2019-06-20 16:36:11",
  //   },
  //   {
  //     id: "5",
  //     center_name: "SEC-22 Civil Hospital ",
  //     short_name: "CH22CH",
  //     center_location: "Chandigarh",
  //     contact_number: null,
  //     is_hub: "no",
  //     is_spoke: "yes",
  //     is_center: "no",
  //     main_hub: "2",
  //     status: "1",
  //     created: "2021-07-04 08:56:00",
  //   },
  //   {
  //     id: "6",
  //     center_name: "SEC-45 Civil Hospital ",
  //     short_name: "CH45CH",
  //     center_location: "Chandigarh",
  //     contact_number: null,
  //     is_hub: "no",
  //     is_spoke: "yes",
  //     is_center: "no",
  //     main_hub: "2",
  //     status: "1",
  //     created: "2021-07-04 09:52:00",
  //   },
  //   {
  //     id: "7",
  //     center_name: "Civil Hospital Manimajra",
  //     short_name: "CHMNMJRA",
  //     center_location: "Manimajra",
  //     contact_number: null,
  //     is_hub: "no",
  //     is_spoke: "yes",
  //     is_center: "no",
  //     main_hub: "2",
  //     status: "1",
  //     created: "2021-07-04 09:52:00",
  //   },
  //   {
  //     id: "8",
  //     center_name: "Jalandhar Hospital",
  //     short_name: "JAL12J",
  //     center_location: "Jalandhar ",
  //     contact_number: null,
  //     is_hub: "yes",
  //     is_spoke: "no",
  //     is_center: "no",
  //     main_hub: null,
  //     status: "1",
  //     created: "2019-03-18 15:05:13",
  //   },
  // ];
  const centers = await executeQuery('Select * from centerscollection');
  res.status(200).send({ data: centers });
};

const getHubs = async (req, res) => {
  // const hubs = [
  //   {
  //     id: "2",
  //     center_name: "PGIMER Emergency",
  //     short_name: "PGI12CH",
  //     center_location: "Chandigarh",
  //     contact_number: null,
  //     is_hub: "yes",
  //     is_spoke: "no",
  //     is_center: "no",
  //     main_hub: null,
  //     status: "1",
  //     created: "2019-03-18 15:05:13",
  //   },
  //   {
  //     id: "8",
  //     center_name: "Jalandhar Hospital",
  //     short_name: "JAL12J",
  //     center_location: "Jalandhar ",
  //     contact_number: null,
  //     is_hub: "yes",
  //     is_spoke: "no",
  //     is_center: "no",
  //     main_hub: null,
  //     status: "1",
  //     created: "2019-03-18 15:05:13",
  //   },
  // ];
  const hubs = await executeQuery('Select * from hubscollection');
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

  // SQL query to retrieve data from the Page table
  const getPageQuery = `
    SELECT id, page_title, page_content, status, created
    FROM Page
    WHERE id = ?;
  `;

  try {
    // Execute the SQL query with the pageId parameter
    const pageResult = await executeQuery(getPageQuery, [pageId]);

    // Check if a page with the given id was found
    if (pageResult.length === 0) {
      return res.status(404).send({ message: "Page not found" });
    }

    // Extract the first (and only) row from the query result
    const pageData = pageResult[0];

    // Send the page data in the response
    res.status(200).send({ data: pageData });
  } catch (error) {
    console.error("Error retrieving page:", error);
    res.status(500).send({ message: "Internal server error" });
  }
};

const uploadFile = async (req, res) => {
  const fileName = req.file?.filename;
  res.status(200).json(fileName);
};

const contactUs = async (req, res) => {
  const headerUserId = req.headers.userid;
  const headerUserToken = req.headers.usertoken;

  if (await ValidateUser(headerUserId, headerUserToken)) {
    const admin = await executeQuery('SELECT * FROM usercollection WHERE admin=true');
    const data = req.body;
    if (admin[0] && admin[0].fcm_userid && admin[0].fcm_userid != "") {
      sendNotification(admin[0].fcm_userid, "contactUs", data);
      sendemail("nitinmittal778@gmail.com", data.message);
    }
    const output = { data: { message: "request_sent" } };
    return res.status(200).json(output);
  } else {
    const output = { data: { message: "INVALID_CREDENTIALS" } };
    return res.status(403).json(output);
  }
};

module.exports = {
  getCenters,
  getHubs,
  globalSettings,
  getSinglePage,
  uploadFile,
  contactUs,
};
