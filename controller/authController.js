const express = require('express');
const User = require('../models/UserCollection');

const signup = async (req,res)=>{
    const data = req.body;
    if(data.first_name == null){
        return res.status(403).json({data:{message: 'Please Enter Valid First Name'}});
    }
    if(data.last_name == null){
        return res.status(403).json({data:{message: 'Please Enter Valid Last Name'}});
    }
    if(data.email_address == null){
        return res.status(403).json({data:{message: 'Please Enter Valid Email Addresss'}});
    }
    // check for other email validations 


    //  Check here for the same email address using Data Base
    const user =await User.findOne({email_address: data.email_address})
    if(user){
        return res.status(403).json({data:{message: ' Email Address already registered'}});
    }

    if(data.phone_number == null){
        return res.status(403).json({data:{message: 'Please Enter Valid Phone Number'}});
    }
    // check for other Phone Number validations 


    if(data.password == null){
        return res.status(403).json({data:{message: 'Please Enter Valid Password'}});
    }
    // check for other Password Validations


    if(data.center_id == null){
        return res.status(403).json({data:{message: 'Please Enter Valid Center Id'}});
    }
    if(data.user_department == null){
        return res.status(403).json({data:{message: 'Please Enter Valid User Department'}});
    }
    if(data.user_role == null){
        return res.status(403).json({data:{message: 'Please Enter Valid User Role'}});
    }

    // Now insert the user info in the insertUser Variable
    const insertUser = {
        first_name : data.first_name,
        last_name: data.last_name,
        full_name: data.first_name+" "+data.last_name,
        email_address: data.email_address,
        phone_number: data.phone_number,
        phone_number_verified: false,
        password: data.password,
        center_id: {
            id: data.center_id,
        },
        user_department: data.user_department,
        user_role: data.user_role,
        last_login: data.last_login,
        online_status: data.online_status,
        status: data.status
    }

    // Now add this insertUser into the dataBase


    const saved_user = await User.insertMany([insertUser]);



    // Store the user and check if it has been stored or not
    //  if signed up then send an sms to every admin

    // get admin numbers and then iterate over it and send an sms message to all.

    // Now also iterate over the admin emails which can be taken from database and 
    //     send an email to every admin to notify a user has been added.


    //  At last send appropriate information
    return res.status(200).send({data:{message: "User has been Created Successfully",userId:saved_user._id}});
}

const login = (req,res)=>{
    const data = req.body;
    
    if(data.email_address == null){
        return res.status(403).json({message: 'Please Enter Valid Email Addresss'});
    }
    // check for other email validations 


    if(data.password == null){
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
    signup,
    login,
    forgotPassword
}