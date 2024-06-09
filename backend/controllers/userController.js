const User = require("../models/User");
var bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { JWT_SECRET } = process.env;

const register = async (req, res) => {
    let { name, email, password, section, role, rollNo } = req.body;

    // Convert to lowercase
    email = email.toLowerCase();
    password = password.toLowerCase();
    section = section.toLowerCase();
    role = role.toLowerCase();
    rollNo = rollNo.toLowerCase();
    name = name.toLowerCase(); // Ensure name is also converted to lowercase

    try {
        let existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashPassword = await bcrypt.hash(password, 10);

        const newUser = new User({ name, email, password: hashPassword, section, role, rollNo });

        await newUser.save();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const login = async (req, res) => {
    let { name, email, password, section, role, rollNo } = req.body;

    // Convert to lowercase
    email = email.toLowerCase();
    password = password.toLowerCase();
    section = section.toLowerCase();
    role = role.toLowerCase();
    rollNo = rollNo.toLowerCase();
    name = name.toLowerCase(); // Ensure name is also converted to lowercase

    try {
        const user = await User.findOne({ email, section, role, rollNo, name });

        if (!user) {
            return res.status(404).json({ message: 'User not found! Please register first.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({
            token,
            name: user.name,
            section: user.section,
            rollNo: user.rollNo,
            role: user.role,
        });
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    register,
    login
};
