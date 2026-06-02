import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/login', { username: username.trim(), password });
      if (response.data.success) {
        sessionStorage.setItem('token', response.data.token);
        if (response.data.user) {
          sessionStorage.setItem('user', JSON.stringify(response.data.user));
        }
        onLogin();
      }
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Too many login attempts. Please wait before trying again.');
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-black">EPMS Login</h2>
        {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-gray-400"
              maxLength={50}
              required
              autoFocus
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-gray-400"
              maxLength={100}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white p-2 rounded hover:bg-gray-800 disabled:bg-gray-400"
          >
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

function EmployeeForm() {
  const [formData, setFormData] = useState({ employeeNumber: '', FirstName: '', LastName: '', Position: '', Address: '', Telephone: '', Gender: 'M', hiredDate: '', DepartmentCode: '', Status: 'Active' });
  const [errors, setErrors] = useState({});
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  useEffect(() => {
    fetchDepartments();
    fetchEmployees();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data);
    } catch {
      setMessage('Failed to load departments');
      setMessageType('error');
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees');
      setEmployees(res.data);
    } catch {
      setMessage('Failed to load employees');
      setMessageType('error');
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.employeeNumber.trim()) newErrors.employeeNumber = 'Employee number is required';
    if (!formData.FirstName.trim()) newErrors.FirstName = 'First name is required';
    if (!formData.LastName.trim()) newErrors.LastName = 'Last name is required';
    if (!formData.Position.trim()) newErrors.Position = 'Position is required';
    if (!formData.DepartmentCode) newErrors.DepartmentCode = 'Department is required';
    if (formData.Telephone && formData.Telephone.length > 20) newErrors.Telephone = 'Telephone too long';
    if (!['Active', 'Inactive'].includes(formData.Status)) newErrors.Status = 'Status must be Active or Inactive';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!validate()) return;

    try {
      await api.post('/employees', formData);
      setMessageType('success');
      setMessage('Employee added successfully!');
      setFormData({ employeeNumber: '', FirstName: '', LastName: '', Position: '', Address: '', Telephone: '', Gender: 'M', hiredDate: '', DepartmentCode: '', Status: 'Active' });
      setErrors({});
      fetchEmployees();
    } catch (err) {
      setMessageType('error');
      if (err.response?.data?.error) {
        setMessage(err.response.data.error);
      } else {
        setMessage('Error adding employee');
      }
    }
  };

  const msgClass = messageType === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700';

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Employee Management</h2>
      {message && <div className={`${msgClass} p-2 rounded mb-4`}>{message}</div>}
      <form onSubmit={handleSubmit} className="bg-gray-50 p-4 sm:p-6 rounded-lg mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <input type="text" placeholder="Employee Number" value={formData.employeeNumber} onChange={(e) => setFormData({ ...formData, employeeNumber: e.target.value })} className={`p-2 border rounded w-full ${errors.employeeNumber ? 'border-red-500' : ''}`} maxLength={20} required />
            {errors.employeeNumber && <p className="text-red-500 text-sm mt-1">{errors.employeeNumber}</p>}
          </div>
          <div>
            <input type="text" placeholder="First Name" value={formData.FirstName} onChange={(e) => setFormData({ ...formData, FirstName: e.target.value })} className={`p-2 border rounded w-full ${errors.FirstName ? 'border-red-500' : ''}`} maxLength={50} required />
            {errors.FirstName && <p className="text-red-500 text-sm mt-1">{errors.FirstName}</p>}
          </div>
          <div>
            <input type="text" placeholder="Last Name" value={formData.LastName} onChange={(e) => setFormData({ ...formData, LastName: e.target.value })} className={`p-2 border rounded w-full ${errors.LastName ? 'border-red-500' : ''}`} maxLength={50} required />
            {errors.LastName && <p className="text-red-500 text-sm mt-1">{errors.LastName}</p>}
          </div>
          <div>
            <input type="text" placeholder="Position" value={formData.Position} onChange={(e) => setFormData({ ...formData, Position: e.target.value })} className={`p-2 border rounded w-full ${errors.Position ? 'border-red-500' : ''}`} maxLength={100} required />
            {errors.Position && <p className="text-red-500 text-sm mt-1">{errors.Position}</p>}
          </div>
          <textarea placeholder="Address" value={formData.Address} onChange={(e) => setFormData({ ...formData, Address: e.target.value })} className="p-2 border rounded" maxLength={500} />
          <div>
            <input type="tel" placeholder="Telephone" value={formData.Telephone} onChange={(e) => setFormData({ ...formData, Telephone: e.target.value })} className={`p-2 border rounded w-full ${errors.Telephone ? 'border-red-500' : ''}`} maxLength={20} />
            {errors.Telephone && <p className="text-red-500 text-sm mt-1">{errors.Telephone}</p>}
          </div>
          <select value={formData.Gender} onChange={(e) => setFormData({ ...formData, Gender: e.target.value })} className="p-2 border rounded">
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
          <input type="date" value={formData.hiredDate} onChange={(e) => setFormData({ ...formData, hiredDate: e.target.value })} className="p-2 border rounded" />
          <div>
            <select value={formData.DepartmentCode} onChange={(e) => setFormData({ ...formData, DepartmentCode: e.target.value })} className={`p-2 border rounded w-full ${errors.DepartmentCode ? 'border-red-500' : ''}`} required>
              <option value="">Select Department</option>
              {departments.map(d => <option key={d.DepartmentCode} value={d.DepartmentCode}>{d.DepartmentName}</option>)}
            </select>
            {errors.DepartmentCode && <p className="text-red-500 text-sm mt-1">{errors.DepartmentCode}</p>}
          </div>
          <div>
            <select value={formData.Status} onChange={(e) => setFormData({ ...formData, Status: e.target.value })} className={`p-2 border rounded w-full ${errors.Status ? 'border-red-500' : ''}`}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            {errors.Status && <p className="text-red-500 text-sm mt-1">{errors.Status}</p>}
          </div>
        </div>
        <button type="submit" className="mt-4 bg-black text-white px-6 py-2 rounded hover:bg-gray-800 w-full sm:w-auto">Add Employee</button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border">
          <thead className="bg-gray-200">
            <tr><th className="border p-2">Emp #</th><th>Name</th><th>Position</th><th>Department</th><th>Phone</th><th>Status</th></tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.employeeNumber}>
                <td className="border p-2">{emp.employeeNumber}</td>
                <td className="border p-2">{emp.FirstName} {emp.LastName}</td>
                <td className="border p-2">{emp.Position}</td>
                <td className="border p-2">{emp.DepartmentCode}</td>
                <td className="border p-2">{emp.Telephone}</td>
                <td className="border p-2">
                  <span className={`px-2 py-1 rounded text-white text-xs ${emp.Status === 'Active' ? 'bg-black' : 'bg-gray-400'}`}>
                    {emp.Status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DepartmentForm() {
  const [formData, setFormData] = useState({ DepartmentCode: '', DepartmentName: '', GrossSalary: '' });
  const [errors, setErrors] = useState({});
  const [departments, setDepartments] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  useEffect(() => { fetchDepartments(); }, []);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data);
    } catch {
      setMessage('Failed to load departments');
      setMessageType('error');
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.DepartmentCode.trim()) newErrors.DepartmentCode = 'Code is required';
    if (formData.DepartmentCode.length > 10) newErrors.DepartmentCode = 'Code max 10 characters';
    if (!formData.DepartmentName.trim()) newErrors.DepartmentName = 'Name is required';
    if (!formData.GrossSalary || parseFloat(formData.GrossSalary) < 0) newErrors.GrossSalary = 'Enter a valid positive salary';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!validate()) return;

    try {
      await api.post('/departments', { ...formData, GrossSalary: parseFloat(formData.GrossSalary) });
      setMessageType('success');
      setMessage('Department added!');
      setFormData({ DepartmentCode: '', DepartmentName: '', GrossSalary: '' });
      setErrors({});
      fetchDepartments();
    } catch (err) {
      setMessageType('error');
      setMessage(err.response?.data?.error || 'Error adding department');
    }
  };

  const msgClass = messageType === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700';

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Department Management</h2>
      {message && <div className={`${msgClass} p-2 rounded mb-4`}>{message}</div>}
      <form onSubmit={handleSubmit} className="bg-gray-50 p-4 sm:p-6 rounded-lg mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <input type="text" placeholder="Code (CW, ST, MC, ADMS)" value={formData.DepartmentCode} onChange={(e) => setFormData({ ...formData, DepartmentCode: e.target.value.toUpperCase() })} className={`p-2 border rounded w-full ${errors.DepartmentCode ? 'border-red-500' : ''}`} maxLength={10} required />
            {errors.DepartmentCode && <p className="text-red-500 text-sm mt-1">{errors.DepartmentCode}</p>}
          </div>
          <div>
            <input type="text" placeholder="Department Name" value={formData.DepartmentName} onChange={(e) => setFormData({ ...formData, DepartmentName: e.target.value })} className={`p-2 border rounded w-full ${errors.DepartmentName ? 'border-red-500' : ''}`} maxLength={50} required />
            {errors.DepartmentName && <p className="text-red-500 text-sm mt-1">{errors.DepartmentName}</p>}
          </div>
          <div>
            <input type="number" placeholder="Gross Salary (RWF)" value={formData.GrossSalary} onChange={(e) => setFormData({ ...formData, GrossSalary: e.target.value })} className={`p-2 border rounded w-full ${errors.GrossSalary ? 'border-red-500' : ''}`} min="0" required />
            {errors.GrossSalary && <p className="text-red-500 text-sm mt-1">{errors.GrossSalary}</p>}
          </div>
        </div>
        <button type="submit" className="mt-4 bg-black text-white px-6 py-2 rounded w-full sm:w-auto">Add Department</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border">
          <thead className="bg-gray-200"><tr><th className="border p-2">Code</th><th>Name</th><th>Gross Salary (RWF)</th></tr></thead>
          <tbody>
            {departments.map(d => <tr key={d.DepartmentCode}><td className="border p-2">{d.DepartmentCode}</td><td className="border p-2">{d.DepartmentName}</td><td className="border p-2">{d.GrossSalary?.toLocaleString()}</td></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SalaryForm() {
  const [formData, setFormData] = useState({ SalaryID: '', DepartmentCode: '', GrossSalary: '', TotalDeduction: '', NetSalary: '', month: '' });
  const [errors, setErrors] = useState({});
  const [salaries, setSalaries] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchSalaries();
    fetchDepartments();
  }, []);

  const fetchSalaries = async () => {
    try {
      const res = await api.get('/salaries');
      setSalaries(res.data);
    } catch {
      setMessage('Failed to load salaries');
      setMessageType('error');
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data);
    } catch {
      setMessage('Failed to load departments');
      setMessageType('error');
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.DepartmentCode) newErrors.DepartmentCode = 'Department is required';
    if (!formData.GrossSalary || parseFloat(formData.GrossSalary) < 0) newErrors.GrossSalary = 'Enter a valid gross salary';
    if (!formData.TotalDeduction || parseFloat(formData.TotalDeduction) < 0) newErrors.TotalDeduction = 'Enter a valid deduction';
    if (!formData.month.trim()) newErrors.month = 'Month is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!validate()) return;

    const netSalary = parseFloat(formData.GrossSalary) - parseFloat(formData.TotalDeduction);
    const data = { DepartmentCode: formData.DepartmentCode, GrossSalary: parseFloat(formData.GrossSalary), TotalDeduction: parseFloat(formData.TotalDeduction), NetSalary: netSalary, month: formData.month.trim() };

    try {
      if (isEditing) {
        await api.put(`/salaries/${formData.SalaryID}`, data);
        setMessageType('success');
        setMessage('Salary updated!');
      } else {
        await api.post('/salaries', data);
        setMessageType('success');
        setMessage('Salary added!');
      }
      setFormData({ SalaryID: '', DepartmentCode: '', GrossSalary: '', TotalDeduction: '', NetSalary: '', month: '' });
      setIsEditing(false);
      setErrors({});
      fetchSalaries();
    } catch (err) {
      setMessageType('error');
      setMessage(err.response?.data?.error || 'Error saving salary record');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this salary record?')) {
      try {
        await api.delete(`/salaries/${id}`);
        fetchSalaries();
        setMessageType('success');
        setMessage('Salary deleted!');
      } catch (err) {
        setMessageType('error');
        setMessage(err.response?.data?.error || 'Error deleting salary');
      }
    }
  };

  const handleEdit = (salary) => {
    setFormData({ ...salary });
    setIsEditing(true);
  };

  const calculateNet = () => {
    const net = (parseFloat(formData.GrossSalary) || 0) - (parseFloat(formData.TotalDeduction) || 0);
    setFormData({ ...formData, NetSalary: net >= 0 ? net : 0 });
  };

  const msgClass = messageType === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700';

  return (
    <div className="p-4 sm:p-6">
      <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Salary Management</h2>
      {message && <div className={`${msgClass} p-2 rounded mb-4`}>{message}</div>}
      <form onSubmit={handleSubmit} className="bg-gray-50 p-4 sm:p-6 rounded-lg mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <select value={formData.DepartmentCode} onChange={(e) => setFormData({ ...formData, DepartmentCode: e.target.value })} className={`p-2 border rounded w-full ${errors.DepartmentCode ? 'border-red-500' : ''}`} required>
              <option value="">Select Department</option>
              {departments.map(d => <option key={d.DepartmentCode} value={d.DepartmentCode}>{d.DepartmentName}</option>)}
            </select>
            {errors.DepartmentCode && <p className="text-red-500 text-sm mt-1">{errors.DepartmentCode}</p>}
          </div>
          <div>
            <input type="number" placeholder="Gross Salary (RWF)" value={formData.GrossSalary} onChange={(e) => setFormData({ ...formData, GrossSalary: e.target.value })} onBlur={calculateNet} className={`p-2 border rounded w-full ${errors.GrossSalary ? 'border-red-500' : ''}`} min="0" required />
            {errors.GrossSalary && <p className="text-red-500 text-sm mt-1">{errors.GrossSalary}</p>}
          </div>
          <div>
            <input type="number" placeholder="Total Deduction (RWF)" value={formData.TotalDeduction} onChange={(e) => setFormData({ ...formData, TotalDeduction: e.target.value })} onBlur={calculateNet} className={`p-2 border rounded w-full ${errors.TotalDeduction ? 'border-red-500' : ''}`} min="0" required />
            {errors.TotalDeduction && <p className="text-red-500 text-sm mt-1">{errors.TotalDeduction}</p>}
          </div>
          <div>
            <input type="text" placeholder="Month (e.g., January 2025)" value={formData.month} onChange={(e) => setFormData({ ...formData, month: e.target.value })} className={`p-2 border rounded w-full ${errors.month ? 'border-red-500' : ''}`} maxLength={20} required />
            {errors.month && <p className="text-red-500 text-sm mt-1">{errors.month}</p>}
          </div>
          <input type="number" placeholder="Net Salary" value={formData.NetSalary} className="p-2 border rounded bg-gray-100" readOnly />
        </div>
        <button type="submit" className="mt-4 bg-black text-white px-6 py-2 rounded hover:bg-gray-800 w-full sm:w-auto">{isEditing ? 'Update Salary' : 'Add Salary'}</button>
        {isEditing && <button type="button" onClick={() => { setIsEditing(false); setFormData({ SalaryID: '', DepartmentCode: '', GrossSalary: '', TotalDeduction: '', NetSalary: '', month: '' }); setErrors({}); }} className="mt-4 ml-0 sm:ml-2 bg-gray-500 text-white px-6 py-2 rounded w-full sm:w-auto">Cancel</button>}
      </form>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border">
          <thead className="bg-gray-200">
            <tr><th className="border p-2">Dept</th><th>Gross (RWF)</th><th>Deduction (RWF)</th><th>Net (RWF)</th><th>Month</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {salaries.map(s => (
              <tr key={s.SalaryID}>
                <td className="border p-2">{s.DepartmentName || s.DepartmentCode}</td>
                <td className="border p-2">{s.GrossSalary?.toLocaleString()}</td>
                <td className="border p-2">{s.TotalDeduction?.toLocaleString()}</td>
                <td className="border p-2 font-bold">{s.NetSalary?.toLocaleString()}</td>
                <td className="border p-2">{s.month}</td>
                <td className="border p-2 whitespace-nowrap">
                  <button onClick={() => handleEdit(s)} className="bg-yellow-500 text-white px-3 py-1 rounded mr-1 mb-1 sm:mb-0">Edit</button>
                  <button onClick={() => handleDelete(s.SalaryID)} className="bg-red-500 text-white px-3 py-1 rounded">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Reports() {
  const [payroll, setPayroll] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchPayroll();
  }, []);

  const fetchPayroll = async () => {
    try {
      const res = await api.get('/monthly-payroll');
      setPayroll(res.data);
    } catch {
      setMessage('Failed to load payroll report');
    }
  };

  const total = payroll.reduce((sum, p) => sum + (p.NetSalary || 0), 0);

  return (
    <div className="p-4 sm:p-6" id="report-content">
      <style>{`
        @media print {
          body { background: white; }
          #report-content { margin: 0; padding: 20px; }
          #report-header { display: block !important; }
          .bg-black { background: black !important; }
        }
        #report-header { display: none; }
      `}</style>

      <div id="report-header" className="text-center mb-6">
        <h1 className="text-3xl font-bold">SmartPark EPMS</h1>
        <p className="text-lg">Monthly Employee Payroll Report</p>
        <p className="text-sm text-gray-500">{new Date().toLocaleDateString()}</p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 print:hidden">
        <h2 className="text-xl sm:text-2xl font-bold">Monthly Employee Payroll Report</h2>
        <button
          onClick={() => window.print()}
          className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800 print:hidden w-full sm:w-auto"
        >
          Print Report
        </button>
      </div>
      {message && <div className="bg-red-100 text-red-700 p-2 rounded mb-4 print:hidden">{message}</div>}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border">
          <thead className="bg-black text-white">
            <tr>
              <th className="border p-3">First Name</th>
              <th className="border p-3">Last Name</th>
              <th className="border p-3">Position</th>
              <th className="border p-3">Department</th>
              <th className="border p-3">Net Salary (RWF)</th>
              <th className="border p-3">Month</th>
            </tr>
          </thead>
          <tbody>
            {payroll.map((p, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="border p-2">{p.FirstName}</td>
                <td className="border p-2">{p.LastName}</td>
                <td className="border p-2">{p.Position}</td>
                <td className="border p-2">{p.DepartmentName}</td>
                <td className="border p-2 font-bold">{p.NetSalary?.toLocaleString()} RWF</td>
                <td className="border p-2">{p.month}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-200 font-bold">
            <tr>
              <td colSpan="4" className="border p-2 text-right">Total</td>
              <td className="border p-2">{total.toLocaleString()} RWF</td>
              <td className="border p-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!sessionStorage.getItem('token'));
  const [navOpen, setNavOpen] = useState(false);

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-black text-white shadow-lg print:hidden">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center py-4">
              <Link to="/" className="text-xl font-bold">SmartPark EPMS</Link>
              <button onClick={() => setNavOpen(!navOpen)} className="md:hidden p-2 hover:text-gray-400 transition">
                {navOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                )}
              </button>
              <div className="hidden md:flex space-x-6">
                <Link to="/employees" className="hover:text-gray-400 transition">Employee</Link>
                <Link to="/departments" className="hover:text-gray-400 transition">Department</Link>
                <Link to="/salaries" className="hover:text-gray-400 transition">Salary</Link>
                <Link to="/reports" className="hover:text-gray-400 transition">Reports</Link>
                <button onClick={handleLogout} className="hover:text-gray-400 transition">Logout</button>
              </div>
            </div>
            {navOpen && (
              <div className="md:hidden pb-4 space-y-2">
                <Link to="/employees" onClick={() => setNavOpen(false)} className="block px-2 py-2 hover:text-gray-400 transition">Employee</Link>
                <Link to="/departments" onClick={() => setNavOpen(false)} className="block px-2 py-2 hover:text-gray-400 transition">Department</Link>
                <Link to="/salaries" onClick={() => setNavOpen(false)} className="block px-2 py-2 hover:text-gray-400 transition">Salary</Link>
                <Link to="/reports" onClick={() => setNavOpen(false)} className="block px-2 py-2 hover:text-gray-400 transition">Reports</Link>
                <button onClick={() => { setNavOpen(false); handleLogout(); }} className="block w-full text-left px-2 py-2 hover:text-gray-400 transition">Logout</button>
              </div>
            )}
          </div>
        </nav>

        <div className="container mx-auto py-4 sm:py-6 px-2 sm:px-4">
          <Routes>
            <Route path="/employees" element={<EmployeeForm />} />
            <Route path="/departments" element={<DepartmentForm />} />
            <Route path="/salaries" element={<SalaryForm />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/" element={<Navigate to="/employees" />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
