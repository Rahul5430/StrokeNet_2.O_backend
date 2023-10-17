const addPatient = async (req, res) => {
    try {
        const headerUserId = req.body.userId;
        const headerUserToken = req.body.userToken;

        // Validate user (you can implement your user validation logic here)
        if (headerUserId && headerUserToken) {
            const data = req.body;
            
            const errors = [];

            if (!data.name || data.name === "") {
                errors.push("Name is required");
            }
            else if (!data.datetime_of_stroke || data.datetime_of_stroke === "") {
                errors.push("Date/Time of Stroke is required");
            }
            else if (!data.weakness_side || data.weakness_side === "") {
                errors.push("Weakness side is required");
            }

            if (errors.length > 0) {
                return res.status(403).json({ message: errors[0] });
            } else {
                const patientData = {};

                if (data.first_name) {
                    patientData.first_name = data.first_name;
                    patientData.name = data.first_name;
                }

                if (data.last_name) {
                    patientData.last_name = data.last_name;
                    patientData.name = `${data.first_name} ${data.last_name}`;
                }

                if (data.name) {

                    if (explodeName[0]) {
                        patientData.first_name = explodeName[0];
                    }

                    if (explodeName[1]) {
                        patientData.last_name = explodeName[1];
                    }

                    patientData.name = data.name;
                }
                if (data.date_of_birth) {
                    patientData.date_of_birth = data.date_of_birth;
                    patientData.age = calculateAge(data.date_of_birth);
                }
    
                if (data.age) {
                    patientData.age = data.age;
                    const today = new Date();
                    const pastDate = new Date(today.getFullYear() - data.age, today.getMonth(), today.getDate());
                    patientData.date_of_birth = formatDate(pastDate);
                }
    
                if (data.gender) {
                    patientData.gender = data.gender;
                }
    
                if (data.weakness_side) {
                    patientData.weakness_side = data.weakness_side;
                }
    
                patientData.created_by = headerUserId;
    
                if (data.contact_number) {
                    patientData.contact_number = data.contact_number;
                }
    
                if (data.address) {
                    patientData.address = data.address;
                }
    
                if (data.covid_score) {
                    patientData.covid_score = data.covid_score;
                }
    
                if (data.covid_values) {
                    patientData.covid_values = data.covid_values;
                }
    
                const center_id = 'your_logic_to_retrieve_center_id';
                patientData.center_id = center_id;
    
                patientData.datetime_of_stroke = formatDate(data.datetime_of_stroke);
    
                // More data assignments...
    
                insertPatient(patientData);
    
                return res.status(200).json(patientData);    
            }
        } else {
            return res.status(403).json({ message: "INVALID_CREDENTIALS" });
        }
    } catch (error) {
        console.error("An error occurred:", error);
        return res.status(500).json({ message: "An error occurred" });
    }
};

