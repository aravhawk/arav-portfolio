"use client";

import React, { useState } from 'react';
import { Mail, Linkedin, Twitter, ExternalLink, ArrowRight } from 'lucide-react';

const StartupDirectory = () => {
  const [activeTab, setActiveTab] = useState('ventures');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
      website: "neuralbytes.net",
      logo: "N"
    }
  ];

  const investments: Array<{
    id: number;
    company: string;
    description: string;
    year: string;
    type: string;
  }> = [];

  const advisoryRoles: Array<{
    id: number;
    company: string;
    role: string;
    industry: string;
    period: string;
  }> = [];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Hero Section */}
      <div className="relative bg-black text-white px-6 py-24 overflow-hidden">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-black/80" />
        
        {/* Geometric pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-64 h-64 border border-white/20 rounded-full" />
          <div className="absolute bottom-20 right-10 w-96 h-96 border border-white/10 rounded-full" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-128 h-128 border border-white/5 rounded-full" />
        </div>
        
        <div className="relative max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Arav Jain
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-8 leading-relaxed">
              Founder & CEO of Infiniflop
            </p>
            <p className="text-lg text-gray-400 mb-12 max-w-2xl leading-relaxed">
              Building the future of GPU compute infrastructure. Making AI accessible through pay-per-FLOP solutions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href="#contact" 
                className="inline-flex items-center px-6 py-3 bg-white text-black font-medium rounded-lg hover:bg-gray-100 transition-all duration-200 hover:scale-105"
              >
                Get in touch
                <ArrowRight className="ml-2 w-4 h-4" />
              </a>
              <button 
                onClick={() => setActiveTab('ventures')} 
                className="inline-flex items-center px-6 py-3 border border-gray-600 text-white font-medium rounded-lg hover:bg-white/10 transition-all duration-200"
              >
                View my work
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-gray-200 z-10">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex justify-between items-center py-4">
            <div className="font-bold text-xl">Arav</div>
            <div className="flex space-x-1">
              {[
                { key: 'ventures', label: 'Ventures' },
                { key: 'investments', label: 'Investments' },
                { key: 'advisory', label: 'Advisory' },
                { key: 'about', label: 'About' }
              ].map((tab) => (
                <button 
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    activeTab === tab.key 
                      ? 'bg-black text-white' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <a 
                href="https://blog.aravjain.dev" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all duration-200 inline-flex items-center"
              >
                Blog
                <ExternalLink className="ml-1 w-3 h-3" />
              </a>
            </div>
          </nav>
        </div>
      </div>
      
      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-16">
        {/* Ventures Section */}
        {activeTab === 'ventures' && (
          <div id="ventures">
            <div className="mb-12">
              <h2 className="text-4xl font-bold mb-4">Ventures</h2>
              <p className="text-xl text-gray-600">Building the future of AI infrastructure</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {ventures.map(venture => (
                <div key={venture.id} className="group border border-gray-200 rounded-xl p-8 hover:shadow-lg hover:border-gray-300 transition-all duration-300">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-black text-white rounded-lg flex items-center justify-center text-xl font-bold">
                      {venture.logo}
                    </div>
                    <div className="flex-grow">
                      <h3 className="text-2xl font-bold mb-2">{venture.name}</h3>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                          {venture.industry}
                        </span>
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          {venture.stage}
                        </span>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                          Est. {venture.founded}
                        </span>
                      </div>
                      <p className="text-gray-600 mb-4 leading-relaxed">{venture.description}</p>
                      <a 
                        href={'https://' + venture.website} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center text-black font-medium hover:underline"
                      >
                        {venture.website}
                        <ExternalLink className="ml-2 w-4 h-4" />
                      </a>
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
            <div className="mb-12">
              <h2 className="text-4xl font-bold mb-4">Investments</h2>
              <p className="text-xl text-gray-600">Supporting the next generation of innovators</p>
            </div>
            
            {investments.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {investments.map(investment => (
                  <div key={investment.id} className="border border-gray-200 rounded-xl p-8 hover:shadow-lg hover:border-gray-300 transition-all duration-300">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-2xl font-bold">{investment.company}</h3>
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                        {investment.year}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm mb-4 font-medium">{investment.type}</p>
                    <p className="text-gray-600 leading-relaxed">{investment.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-24">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <div className="w-8 h-8 border-2 border-gray-300 rounded-full" />
                </div>
                <h3 className="text-2xl font-bold text-gray-400 mb-2">Coming Soon</h3>
                <p className="text-gray-500">Building my investment portfolio</p>
              </div>
            )}
          </div>
        )}
        
        {/* Advisory Section */}
        {activeTab === 'advisory' && (
          <div id="advisory">
            <div className="mb-12">
              <h2 className="text-4xl font-bold mb-4">Advisory</h2>
              <p className="text-xl text-gray-600">Strategic guidance for emerging companies</p>
            </div>
            
            {advisoryRoles.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {advisoryRoles.map(role => (
                  <div key={role.id} className="border border-gray-200 rounded-xl p-8 hover:shadow-lg hover:border-gray-300 transition-all duration-300">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-2xl font-bold">{role.company}</h3>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        {role.period}
                      </span>
                    </div>
                    <p className="text-gray-600">{role.role} • {role.industry}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-24">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <div className="w-8 h-8 border-2 border-gray-300 rounded-full" />
                </div>
                <h3 className="text-2xl font-bold text-gray-400 mb-2">Coming Soon</h3>
                <p className="text-gray-500">Open to advisory opportunities</p>
              </div>
            )}
          </div>
        )}
        
        {/* About Section */}
        {activeTab === 'about' && (
          <div id="about">
            <div className="mb-12">
              <h2 className="text-4xl font-bold mb-4">About</h2>
              <p className="text-xl text-gray-600">Engineer, entrepreneur, and AI infrastructure pioneer</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              <div className="lg:col-span-2">
                <div className="prose max-w-none text-gray-600 leading-relaxed space-y-6">
                  <p className="text-lg">
                    I&apos;m a software engineer and entrepreneur passionate about the intersection of artificial intelligence and blockchain technology. As the Founder & CEO of Infiniflop, I&apos;m building pay-per-FLOP GPU compute solutions that make AI infrastructure more accessible and efficient.
                  </p>
                  <p>
                    My technical background spans machine learning, deep learning with PyTorch, and blockchain development. I&apos;m currently developing Tensorcoin, a high-performance blockchain powered by GPUs that aims to redefine cryptocurrency efficiency by addressing the speed and energy concerns of traditional blockchain systems.
                  </p>
                  <p>
                    I&apos;ve open-sourced several projects including IntergalacticPro (a space-focused AI chatbot), SumQuick (an AI summarization tool that runs locally using Ollama), and various AI/ML tools. I&apos;m also expanding my skills in Swift development for Apple platforms while continuing to push the boundaries of what&apos;s possible with GPU-accelerated computing.
                  </p>
                </div>
              </div>
              
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-bold mb-4">Current Projects</h3>
                  <ul className="space-y-3 text-gray-600">
                    <li className="flex items-start">
                      <div className="w-1.5 h-1.5 bg-black rounded-full mt-2 mr-3 flex-shrink-0" />
                      <span>Infiniflop - Pay-per-FLOP GPU compute platform</span>
                    </li>
                    <li className="flex items-start">
                      <div className="w-1.5 h-1.5 bg-black rounded-full mt-2 mr-3 flex-shrink-0" />
                      <span>NeuralBytes - AI tools and experiences</span>
                    </li>
                    <li className="flex items-start">
                      <div className="w-1.5 h-1.5 bg-black rounded-full mt-2 mr-3 flex-shrink-0" />
                      <span>Tensorcoin - GPU-powered blockchain infrastructure</span>
                    </li>
                    <li className="flex items-start">
                      <div className="w-1.5 h-1.5 bg-black rounded-full mt-2 mr-3 flex-shrink-0" />
                      <span>Open-source AI/ML tools and research</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-xl font-bold mb-4">Technical Expertise</h3>
                  <ul className="space-y-3 text-gray-600">
                    <li className="flex items-start">
                      <div className="w-1.5 h-1.5 bg-black rounded-full mt-2 mr-3 flex-shrink-0" />
                      <span>Machine Learning & Deep Learning (PyTorch)</span>
                    </li>
                    <li className="flex items-start">
                      <div className="w-1.5 h-1.5 bg-black rounded-full mt-2 mr-3 flex-shrink-0" />
                      <span>GPU Computing & CUDA</span>
                    </li>
                    <li className="flex items-start">
                      <div className="w-1.5 h-1.5 bg-black rounded-full mt-2 mr-3 flex-shrink-0" />
                      <span>Blockchain Development</span>
                    </li>
                    <li className="flex items-start">
                      <div className="w-1.5 h-1.5 bg-black rounded-full mt-2 mr-3 flex-shrink-0" />
                      <span>Python, JavaScript, Swift</span>
                    </li>
                    <li className="flex items-start">
                      <div className="w-1.5 h-1.5 bg-black rounded-full mt-2 mr-3 flex-shrink-0" />
                      <span>AI Infrastructure & Deployment</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-xl font-bold mb-4">Focus Areas</h3>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Artificial Intelligence',
                      'Machine Learning',
                      'Generative AI',
                      'Blockchain',
                      'GPU Computing',
                      'Cryptocurrency'
                    ].map((area) => (
                      <span key={area} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Contact Section */}
      <div id="contact" className="bg-black text-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12">
            <h2 className="text-4xl font-bold mb-4">Get in Touch</h2>
            <p className="text-xl text-gray-300">Ready to build something amazing together?</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <p className="text-gray-300 mb-8 text-lg leading-relaxed">
                Interested in connecting? I&apos;m always open to discussing new projects, investment opportunities, or strategic partnerships.
              </p>
              
              <div className="space-y-6">
                {[
                  { icon: Mail, label: 'aravhawk@gmail.com', href: 'mailto:aravhawk@gmail.com' },
                  { icon: Linkedin, label: 'linkedin.com/in/aravjainml', href: 'https://linkedin.com/in/aravjainml' },
                  { icon: Twitter, label: 'x.com/aravhawk', href: 'https://x.com/aravhawk' }
                ].map((contact) => (
                  <a
                    key={contact.label}
                    href={contact.href}
                    target={contact.href.startsWith('http') ? '_blank' : undefined}
                    rel={contact.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="flex items-center group hover:text-gray-300 transition-colors duration-200"
                  >
                    <div className="w-10 h-10 flex items-center justify-center bg-gray-800 rounded-lg mr-4 group-hover:bg-gray-700 transition-colors duration-200">
                      <contact.icon size={18} />
                    </div>
                    <span className="text-lg">{contact.label}</span>
                  </a>
                ))}
              </div>
            </div>
            
            <div className="border border-gray-800 rounded-xl p-8 bg-gray-900/50">
              <h3 className="text-2xl font-bold mb-6">Send a Message</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2" htmlFor="name">Name</label>
                  <input 
                    type="text" 
                    id="name" 
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full p-3 rounded-lg bg-black border border-gray-700 text-white placeholder-gray-400 focus:border-gray-500 focus:outline-none transition-colors duration-200" 
                    placeholder="Your name" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" htmlFor="email">Email</label>
                  <input 
                    type="email" 
                    id="email" 
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full p-3 rounded-lg bg-black border border-gray-700 text-white placeholder-gray-400 focus:border-gray-500 focus:outline-none transition-colors duration-200" 
                    placeholder="your@email.com" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2" htmlFor="message">Message</label>
                  <textarea 
                    id="message" 
                    name="message"
                    rows={4} 
                    value={formData.message}
                    onChange={handleInputChange}
                    className="w-full p-3 rounded-lg bg-black border border-gray-700 text-white placeholder-gray-400 focus:border-gray-500 focus:outline-none transition-colors duration-200 resize-none" 
                    placeholder="Tell me about your project..."
                  ></textarea>
                </div>
                <button 
                  onClick={handleSendMessage}
                  className="w-full bg-white text-black font-medium py-3 px-6 rounded-lg hover:bg-gray-100 transition-all duration-200 hover:scale-105 flex items-center justify-center"
                >
                  Send Message
                  <ArrowRight className="ml-2 w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-gray-500">© {new Date().getFullYear()} Arav Jain • Building the future of AI infrastructure</p>
        </div>
      </footer>
    </div>
  );
};

export default StartupDirectory;
