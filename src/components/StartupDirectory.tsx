"use client";

import React, { useState } from 'react';
import { Mail, Linkedin, Twitter } from 'lucide-react';

const StartupDirectory = () => {
  const [activeTab, setActiveTab] = useState('ventures');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  
  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };
  
  const handleSendMessage = () => {
    const { name, email, message } = formData;
    
    if (!name || !email || !message) {
      alert('Please fill in all fields before sending.');
      return;
    }
    
    const subject = `Contact from ${name} via Portfolio`;
    const body = `Name: ${name}
Email: ${email}

Message:
${message}

---
Sent from Arav Jain's Portfolio Directory`;
    
    const mailtoLink = `mailto:aravhawk@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
    
    // Clear form after sending
    setFormData({ name: '', email: '', message: '' });
  };
  
  // Your actual ventures
  const ventures = [
    {
      id: 1,
      name: "Infiniflop",
      description: "Pay-per-FLOP GPU compute with 1-line deployment.",
      industry: "GPUs / AI",
      founded: "2025",
      stage: "Pre-seed",
      website: "infiniflop.com",
      logo: "I"
    },
    {
      id: 2,
      name: "NeuralBytes",
      description: "Integrating AI to create unique tools and experiences.",
      industry: "SaaS / AI",
      founded: "2024",
      stage: "Pre-seed",
      website: "neuralbytes.com",
      logo: "N"
    }
  ];

  const investments = [];

  const advisoryRoles = [];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Hero Section */}
      <div className="bg-indigo-900 text-white px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-4xl font-bold mb-2">Arav Jain</h1>
          <p className="text-xl text-indigo-100 mb-6">Founder & CEO of Infiniflop</p>
          <div className="flex space-x-4">
            <a href="#contact" className="bg-white text-indigo-900 px-4 py-2 rounded-md font-medium hover:bg-indigo-100 transition">Contact</a>
            <button onClick={() => setActiveTab('ventures')} className="border border-white text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-800 transition">View Ventures</button>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <div className="sticky top-0 bg-white shadow-md z-10">
        <div className="max-w-5xl mx-auto px-6">
          <nav className="flex justify-between items-center py-4">
            <div className="font-bold text-xl text-indigo-900">Arav's Portfolio</div>
            <div className="flex space-x-1">
              <button 
                onClick={() => setActiveTab('ventures')}
                className={`px-4 py-2 rounded-md font-medium ${activeTab === 'ventures' ? 'bg-indigo-100 text-indigo-900' : 'text-gray-600 hover:bg-gray-100'}`}>
                Ventures
              </button>
              <button 
                onClick={() => setActiveTab('investments')}
                className={`px-4 py-2 rounded-md font-medium ${activeTab === 'investments' ? 'bg-indigo-100 text-indigo-900' : 'text-gray-600 hover:bg-gray-100'}`}>
                Investments
              </button>
              <button 
                onClick={() => setActiveTab('advisory')}
                className={`px-4 py-2 rounded-md font-medium ${activeTab === 'advisory' ? 'bg-indigo-100 text-indigo-900' : 'text-gray-600 hover:bg-gray-100'}`}>
                Advisory
              </button>
              <button 
                onClick={() => setActiveTab('about')}
                className={`px-4 py-2 rounded-md font-medium ${activeTab === 'about' ? 'bg-indigo-100 text-indigo-900' : 'text-gray-600 hover:bg-gray-100'}`}>
                About
              </button>
            </div>
          </nav>
        </div>
      </div>
      
      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Ventures Section */}
        {activeTab === 'ventures' && (
          <div id="ventures">
            <h2 className="text-3xl font-bold mb-8 text-indigo-900 border-b pb-4">My Ventures</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {ventures.map(venture => (
                <div key={venture.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
                  <div className="flex">
                    <div className="flex-shrink-0 bg-indigo-700 text-white w-16 h-16 flex items-center justify-center text-2xl font-bold">
                      {venture.logo}
                    </div>
                    <div className="p-6 flex-grow">
                      <h3 className="text-xl font-bold text-indigo-900 mb-1">{venture.name}</h3>
                      <p className="text-sm text-gray-500 mb-3">
                        <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs mr-2">{venture.industry}</span>
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs mr-2">{venture.stage}</span>
                        <span className="text-gray-500">Est. {venture.founded}</span>
                      </p>
                      <p className="text-gray-600 mb-3">{venture.description}</p>
                      <a href={'https://' + venture.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">{venture.website} →</a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Investments Section */}
        {activeTab === 'investments' && (
          <div id="investments">
            <h2 className="text-3xl font-bold mb-8 text-indigo-900 border-b pb-4">My Investments</h2>
            {investments.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {investments.map(investment => (
                  <div key={investment.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
                    <div className="flex items-start justify-between">
                      <h3 className="text-xl font-bold text-indigo-900 mb-1">{investment.company}</h3>
                      <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">{investment.year}</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">{investment.type}</p>
                    <p className="text-gray-600">{investment.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">Nothing to see here yet!</p>
              </div>
            )}
          </div>
        )}
        
        {/* Advisory Section */}
        {activeTab === 'advisory' && (
          <div id="advisory">
            <h2 className="text-3xl font-bold mb-8 text-indigo-900 border-b pb-4">Advisory Roles</h2>
            {advisoryRoles.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {advisoryRoles.map(role => (
                  <div key={role.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
                    <div className="flex items-start justify-between">
                      <h3 className="text-xl font-bold text-indigo-900 mb-1">{role.company}</h3>
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">{role.period}</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">{role.role} • {role.industry}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">Nothing to see here yet!</p>
              </div>
            )}
          </div>
        )}
        
        {/* About Section */}
        {activeTab === 'about' && (
          <div id="about">
            <h2 className="text-3xl font-bold mb-8 text-indigo-900 border-b pb-4">About Me</h2>
            <div className="bg-white rounded-lg shadow-md p-8">
              <div className="prose max-w-none">
                <p className="mb-4">
                  I'm a software engineer and entrepreneur passionate about the intersection of artificial intelligence and blockchain technology. As the Founder & CEO of Infiniflop, I'm building pay-per-FLOP GPU compute solutions that make AI infrastructure more accessible and efficient.
                </p>
                <p className="mb-4">
                  My technical background spans machine learning, deep learning with PyTorch, and blockchain development. I'm currently developing Tensorcoin, a high-performance blockchain powered by GPUs that aims to redefine cryptocurrency efficiency by addressing the speed and energy concerns of traditional blockchain systems.
                </p>
                <p className="mb-4">
                  I've open-sourced several projects including IntergalacticPro (a space-focused AI chatbot), SumQuick (an AI summarization tool that runs locally using Ollama), and various AI/ML tools. I'm also expanding my skills in Swift development for Apple platforms while continuing to push the boundaries of what's possible with GPU-accelerated computing.
                </p>
                <h3 className="text-xl font-bold mt-6 mb-4">Current Projects</h3>
                <ul className="list-disc pl-5 mb-4">
                  <li>Infiniflop - Pay-per-FLOP GPU compute platform</li>
                  <li>NeuralBytes - AI tools and experiences</li>
                  <li>Tensorcoin - GPU-powered blockchain infrastructure</li>
                  <li>Open-source AI/ML tools and research</li>
                </ul>
                <h3 className="text-xl font-bold mt-6 mb-4">Technical Expertise</h3>
                <ul className="list-disc pl-5 mb-4">
                  <li>Machine Learning & Deep Learning (PyTorch)</li>
                  <li>GPU Computing & CUDA</li>
                  <li>Blockchain Development</li>
                  <li>Python, JavaScript, Swift</li>
                  <li>AI Infrastructure & Deployment</li>
                </ul>
                <h3 className="text-xl font-bold mt-6 mb-4">Areas of Interest</h3>
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm">Artificial Intelligence</span>
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">Machine Learning</span>
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">Generative AI</span>
                  <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm">Blockchain</span>
                  <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm">GPU Computing</span>
                  <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">Cryptocurrency</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Contact Section */}
      <div id="contact" className="bg-indigo-900 text-white py-12">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-8 text-white">Get In Touch</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <p className="mb-4">
                Interested in connecting? I'm always open to discussing new projects, investment opportunities, or strategic partnerships.
              </p>
              <div className="mt-6 space-y-4">
                <div className="flex items-center">
                  <div className="w-8 h-8 flex items-center justify-center bg-indigo-800 rounded-full mr-3">
                    <Mail size={16} />
                  </div>
                  <a href="mailto:aravhawk@gmail.com" className="hover:text-indigo-200 transition">aravhawk@gmail.com</a>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 flex items-center justify-center bg-indigo-800 rounded-full mr-3">
                    <Linkedin size={16} />
                  </div>
                  <a href="https://linkedin.com/in/aravjainml" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-200 transition">linkedin.com/in/aravjainml</a>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 flex items-center justify-center bg-indigo-800 rounded-full mr-3">
                    <Twitter size={16} />
                  </div>
                  <a href="https://x.com/aravhawk" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-200 transition">x.com/aravhawk</a>
                </div>
              </div>
            </div>
            <div className="bg-indigo-800 rounded-lg p-6">
              <h3 className="text-xl font-bold mb-4">Send a Message</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="name">Name</label>
                  <input 
                    type="text" 
                    id="name" 
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full p-2 rounded bg-indigo-700 border border-indigo-600 text-white placeholder-indigo-300" 
                    placeholder="Your name" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="email">Email</label>
                  <input 
                    type="email" 
                    id="email" 
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full p-2 rounded bg-indigo-700 border border-indigo-600 text-white placeholder-indigo-300" 
                    placeholder="Your email" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="message">Message</label>
                  <textarea 
                    id="message" 
                    name="message"
                    rows="4" 
                    value={formData.message}
                    onChange={handleInputChange}
                    className="w-full p-2 rounded bg-indigo-700 border border-indigo-600 text-white placeholder-indigo-300" 
                    placeholder="Your message"
                  ></textarea>
                </div>
                <button 
                  onClick={handleSendMessage}
                  className="w-full bg-white text-indigo-900 font-medium py-2 px-4 rounded hover:bg-indigo-100 transition"
                >
                  Send Message
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="bg-indigo-950 text-indigo-300 py-6">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p>© {new Date().getFullYear()} Arav Jain • All Rights Reserved</p>
        </div>
      </footer>
    </div>
  );
};

export default StartupDirectory;
