const express = require('express');
const User = require('../models/UserCollection');

const signUp = async (req,res)=>{
    const data = req.body;

    if(data.first_name == ""){
        return res.status(403).json({message: 'Please Enter Valid First Name'});
    }
    if(data.last_name == ""){
        return res.status(403).json({message: 'Please Enter Valid Last Name'});
    }
    if(data.email_address == ""){
        return res.status(403).json({message: 'Please Enter Valid Email Addresss'});
    }
    // check for other email validations 


    //  Check here for the same email address using Data Base
    const user = User.find({"email_address": data.email_address})
    // if(user){

    // }

    if(data.phone_number == ""){
        return res.status(403).json({message: 'Please Enter Valid Phone Number'});
    }
    // check for other Phone Number validations 


    if(data.password == ""){
        return res.status(403).json({message: 'Please Enter Valid Password'});
    }
    // check for other Password Validations


    if(data.center_id == ""){
        return res.status(403).json({message: 'Please Enter Valid Center Id'});
    }
    if(data.user_department == ""){
        return res.status(403).json({message: 'Please Enter Valid User Department'});
    }
    if(data.user_role == ""){
        return res.status(403).json({message: 'Please Enter Valid User Role'});
    }

    // Now insert the user info in the insertUser Variable
    const insertUser = {
        first_name : req.first_name,
        last_name: req.last_name,
        full_name: first_name+last_name,
        email_address: req.email_address,
        phone_number: req.phone_number,
        phone_number_verified: false,
        password: req.password,
        center_id: {
            id: req.center_id,
            
        },
        user_department: req.user_department,
        user_role: req.user_role,
        last_login: req.last_login,
        online_status: req.online_status,
        status: req.status
    }

    // Now add this insertUser into the dataBase
    const saved_user = await User.insertOne(insertUser);



    // Store the user and check if it has been stored or not
    //  if signed up then send an sms to every admin

    // get admin numbers and then iterate over it and send an sms message to all.

    // Now also iterate over the admin emails which can be taken from database and 
    //     send an email to every admin to notify a user has been added.


    //  At last send appropriate information
    return res.status(200).json({message: "User has been Created Successfully"})
}

const login = (req,res)=>{
    const data = req.body;
    
    if(data.email_address == ""){
        return res.status(403).json({message: 'Please Enter Valid Email Addresss'});
    }
    // check for other email validations 


    if(data.password == ""){
        return res.status(403).json({message: 'Please Enter Valid Password'});
    }
    // check for other Password Validations

    const user_email = data.email_address;
    const password = data.password;

    // Check in the dataBase if email_address exist and then check for that user if password matches
    //  And then store the User.


    //  Do further checkings and then return the reqired information
}

const forgotPassword = (req,res)=>{
    // Implement the forgotPassword Function
}

module.exports = {
    signUp,
    login,
    forgotPassword
}