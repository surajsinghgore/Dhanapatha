import {  loginUserHandler, RegisterUserHandler } from "../handlers/handler.js";
import { User } from "../models/User.model.js";


export const RegisterUser = async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    try {
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            const message = existingUser.email === email
                ? "An account already exists with this email"
                : "An account already exists with this username.";
            return res.status(400).json({ success: false, message });
        }

        // Call the handler without redefining 'res'
        return await RegisterUserHandler(req, res);

    } catch (error) {
        console.error("Error registering user:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};



export const loginUser = async (req, res) => {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    try {
        const { user, token } = await loginUserHandler(usernameOrEmail, password);

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            user: {
                _id: user._id,
                email: user.email,
                username: user.username
            },
            token
        });
    } catch (error) {
        console.error("Error logging in user:", error);
        return res.status(400).json({ success: false, message: error.message });
    }
};

export const searchUsers = async (req, res) => {
    try {
      const { searchterm } = req.query;
  
      const userId = req.user._id;
  
      let query = { _id: { $ne: userId } }; 
  
    
      if (searchterm) {
        query = {
          ...query, 
          $or: [
            { username: { $regex: searchterm, $options: 'i' } }, 
            { email: { $regex: searchterm, $options: 'i' } } 
          ]
        };
      }
  
      const users = await User.find(query, 'username email').sort({ createdAt: -1 }).limit(10);
      return res.status(200).json({ users });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };




  export const changePassword = async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      const userId = req.user._id; 
  

      if (!oldPassword || !newPassword) {
        return res.status(400).json({ status: false, message: "Old password and new password are required." });
      }
  

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ status: false, message: "User not found." });
      }
  

      const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
      if (!isPasswordCorrect) {
        return res.status(400).json({ status: false, message: "Incorrect old password." });
      }

      const isSamePassword = await user.isPasswordCorrect(newPassword);
      if (isSamePassword) {
        return res.status(400).json({ status: false, message: "New password cannot be the same as the old password." });
      }

      user.password = newPassword; 
      await user.save(); 

      return res.status(200).json({ status: true, message: "Password updated successfully." });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ status: false, message: "Internal server error." });
    }
  };