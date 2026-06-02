-- Create Database
CREATE DATABASE IF NOT EXISTS EPMS;
USE EPMS;

-- Create Department table
CREATE TABLE IF NOT EXISTS Department (
    DepartmentCode VARCHAR(10) PRIMARY KEY,
    DepartmentName VARCHAR(50) NOT NULL,
    GrossSalary DECIMAL(12,2)
);

-- Create Employee table
CREATE TABLE IF NOT EXISTS Employee (
    employeeNumber VARCHAR(20) PRIMARY KEY,
    FirstName VARCHAR(50) NOT NULL,
    LastName VARCHAR(50) NOT NULL,
    Position VARCHAR(100),
    Address TEXT,
    Telephone VARCHAR(20),
    Gender ENUM('M', 'F'),
    hiredDate DATE,
    DepartmentCode VARCHAR(10),
    Status VARCHAR(20) DEFAULT 'Active',
    FOREIGN KEY (DepartmentCode) REFERENCES Department(DepartmentCode)
);

-- Create Salary table
CREATE TABLE IF NOT EXISTS Salary (
    SalaryID INT AUTO_INCREMENT PRIMARY KEY,
    DepartmentCode VARCHAR(10),
    GrossSalary DECIMAL(12,2),
    TotalDeduction DECIMAL(12,2),
    NetSalary DECIMAL(12,2),
    month VARCHAR(20),
    FOREIGN KEY (DepartmentCode) REFERENCES Department(DepartmentCode)
);

-- Create Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert Department data
INSERT IGNORE INTO Department VALUES
('CW', 'Carwash', 300000),
('ST', 'Stock', 200000),
('MC', 'Mechanic', 450000),
('ADMS', 'Administration Staff', 600000);

-- Insert Salary data
INSERT IGNORE INTO Salary (DepartmentCode, GrossSalary, TotalDeduction, NetSalary, month) VALUES
('CW', 300000, 20000, 280000, 'January 2025'),
('ST', 200000, 5000, 195000, 'January 2025'),
('MC', 450000, 40000, 410000, 'January 2025'),
('ADMS', 600000, 70000, 530000, 'January 2025');

-- Insert sample Employee
INSERT IGNORE INTO Employee (employeeNumber, FirstName, LastName, Position, Address, Telephone, Gender, hiredDate, DepartmentCode, Status) VALUES
('EMP001', 'John', 'Doe', 'Manager', 'Kigali', '0788888888', 'M', '2023-01-15', 'ADMS', 'Active'),
('EMP002', 'Jane', 'Smith', 'Cashier', 'Rubavu', '0788888889', 'F', '2023-02-01', 'CW', 'Active');

-- Insert default admin user (password: admin123)
INSERT IGNORE INTO users (username, password, role) VALUES
('admin', '$2a$10$rMd0PF5H9WOuY6ptNvoApOkeyG0lP3wigGsvGR.kLdu.83OPCTMey', 'admin');
