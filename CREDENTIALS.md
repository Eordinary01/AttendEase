# 🔐 AttendEase — System Login Credentials & Portal Guide

This document contains all seeded user accounts, login URLs, passwords, and role descriptions for testing and administration.

---

## 👑 1. Platform Super Admin (Cross-Tenant Management)

The Super Admin has platform-level access to view all institution tenants, monitor system logs, manage subscriptions, and audit security events.

- **Super Admin Login URL**: [http://localhost:3000/super/login](http://localhost:3000/super/login)
- **Email**: `attendease244@gmail.com`
- **Password**: `attendease@123`
- **Role**: `super_admin`

---

## 🏢 2. Tenant 1: Enterprise Plan (**Delhi Public Institute of Technology**)

- **Subdomain**: `dpit`
- **Institution Portal URL**: [http://localhost:3000/login/dpit](http://localhost:3000/login/dpit)
- **Plan**: Enterprise (Unlimited Students & Teachers, Custom Roles, Parent Portal, Online Payments)

### User Accounts:

| Role | Name | Email | Password | Details |
|---|---|---|---|---|
| 👨‍💼 **Tenant Admin** | Dr. Rajesh Kumar | `admin@dpit.edu.in` | `Admin@123` | Full tenant admin access & settings |
| 👨‍🏫 **Teacher 1** | Dr. Ananya Sharma | `teacher1@dpit.edu.in` | `Teacher@123` | HOD Computer Science & Engineering |
| 👨‍🏫 **Teacher 2** | Prof. Vikramaditya Singh | `teacher2@dpit.edu.in` | `Teacher@123` | Faculty Information Technology |
| 👨‍🏫 **Teacher 3** | Dr. Ritu Verma | `teacher3@dpit.edu.in` | `Teacher@123` | Faculty Artificial Intelligence & ML |
| 👨‍🏫 **Teacher 4** | Prof. Amit Patel | `teacher4@dpit.edu.in` | `Teacher@123` | Faculty Software Engineering |
| 👨‍🎓 **Student 1** | Aarav Sharma | `student1@dpit.edu.in` | `Student@123` | B.Tech CSE, Sem 3, Sec A (Roll: `DPIT-2024-001`) |
| 👨‍🎓 **Student 2** | Aditi Rao | `student2@dpit.edu.in` | `Student@123` | B.Tech CSE, Sem 3, Sec A (Roll: `DPIT-2024-002`) |
| 👨‍🎓 **Student 3** | Bhavya Gupta | `student3@dpit.edu.in` | `Student@123` | B.Tech CSE, Sem 3, Sec A (Roll: `DPIT-2024-003`) |
| 👪 **Parent 1** | Parent of Aarav Sharma | `parent1@gmail.com` | `Student@123` | Linked to `student1@dpit.edu.in` |
| 👪 **Parent 2** | Parent of Aditi Rao | `parent2@gmail.com` | `Student@123` | Linked to `student2@dpit.edu.in` |

---

## 🏫 3. Tenant 2: Basic Plan (**Greenfield Academy**)

- **Subdomain**: `greenfield`
- **Institution Portal URL**: [http://localhost:3000/login/greenfield](http://localhost:3000/login/greenfield)
- **Plan**: Basic (Up to 500 Students, 35 Teachers, Attendance & Timetable Modules)

### User Accounts:

| Role | Name | Email | Password | Details |
|---|---|---|---|---|
| 👨‍💼 **Tenant Admin** | Mrs. Sunita Deshmukh | `admin@greenfield.edu.in` | `Admin@123` | Greenfield Institute Admin |
| 👨‍🏫 **Teacher** | Mr. Suresh Nair | `teacher1@greenfield.edu.in` | `Teacher@123` | Faculty Physics (Higher Secondary) |
| 👨‍🎓 **Student 1** | Aarav Mehta | `student1@greenfield.edu.in` | `Student@123` | Science, Sem 1, Sec A (Roll: `GFA-2024-001`) |
| 👨‍🎓 **Student 2** | Ananya Pandit | `student2@greenfield.edu.in` | `Student@123` | Science, Sem 1, Sec A (Roll: `GFA-2024-002`) |

---

## 📌 Quick Summary Table

| Subdomain | Role | Email | Password | Portal URL |
|---|---|---|---|---|
| Platform | Super Admin | `attendease244@gmail.com` | `attendease@123` | [http://localhost:3000/super/login](http://localhost:3000/super/login) |
| `dpit` | Admin | `admin@dpit.edu.in` | `Admin@123` | [http://localhost:3000/login/dpit](http://localhost:3000/login/dpit) |
| `dpit` | Teacher | `teacher1@dpit.edu.in` | `Teacher@123` | [http://localhost:3000/login/dpit](http://localhost:3000/login/dpit) |
| `dpit` | Student | `student1@dpit.edu.in` | `Student@123` | [http://localhost:3000/login/dpit](http://localhost:3000/login/dpit) |
| `dpit` | Parent | `parent1@gmail.com` | `Student@123` | [http://localhost:3000/login/dpit](http://localhost:3000/login/dpit) |
| `greenfield` | Admin | `admin@greenfield.edu.in` | `Admin@123` | [http://localhost:3000/login/greenfield](http://localhost:3000/login/greenfield) |
| `greenfield` | Teacher | `teacher1@greenfield.edu.in` | `Teacher@123` | [http://localhost:3000/login/greenfield](http://localhost:3000/login/greenfield) |
| `greenfield` | Student | `student1@greenfield.edu.in` | `Student@123` | [http://localhost:3000/login/greenfield](http://localhost:3000/login/greenfield) |

---

## ⚙️ How to Re-seed Dataset
To reset or re-populate the MongoDB database with this bulk dataset at any time, run:
```bash
node bulk/seedBulkData.js
```
