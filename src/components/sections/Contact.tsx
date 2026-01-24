'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Linkedin, Twitter, ArrowRight } from 'lucide-react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import GridBackground from '@/components/ui/GridBackground';
import { socialLinks } from '@/lib/data';
import { fadeInUp, staggerContainer, viewportSettings } from '@/lib/animations';

const iconMap = {
  mail: Mail,
  linkedin: Linkedin,
  twitter: Twitter,
  github: null
};

export default function Contact() {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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
Sent from Arav Jain's Portfolio`;

    const mailtoLink = `mailto:aravhawk@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;

    setFormData({ name: '', email: '', message: '' });
  };

  const displayedSocials = socialLinks.filter(
    (link) => iconMap[link.icon] !== null
  );

  return (
    <section id="contact" className="relative py-24 bg-[#0a0a0a] overflow-hidden">
      {/* Grid Background */}
      <GridBackground fade="top" className="opacity-50" />

      <div className="relative max-w-6xl mx-auto px-6">
        {/* Header */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          whileInView="animate"
          viewport={viewportSettings}
          className="mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Get in Touch
          </h2>
          <p className="text-xl text-[#a1a1aa]">
            Ready to build something amazing together?
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={viewportSettings}
          className="grid grid-cols-1 lg:grid-cols-2 gap-12"
        >
          {/* Left Column - Info */}
          <motion.div variants={fadeInUp}>
            <p className="text-[#a1a1aa] text-lg mb-8 leading-relaxed">
              Interested in connecting? I&apos;m always open to discussing new projects, investment opportunities, or strategic partnerships.
            </p>

            <div className="space-y-4">
              {displayedSocials.map((link) => {
                const Icon = iconMap[link.icon];
                return Icon ? (
                  <a
                    key={link.label}
                    href={link.href}
                    target={link.href.startsWith('http') ? '_blank' : undefined}
                    rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="flex items-center gap-4 group hover:text-white text-[#a1a1aa] transition-colors duration-200"
                  >
                    <div className="w-10 h-10 flex items-center justify-center bg-[#1a1a1a] rounded-lg group-hover:bg-[#262626] transition-colors duration-200">
                      <Icon size={18} />
                    </div>
                    <span className="text-lg">{link.label}</span>
                  </a>
                ) : null;
              })}
            </div>
          </motion.div>

          {/* Right Column - Form */}
          <motion.div variants={fadeInUp}>
            <Card hover={false} className="bg-[#111]">
              <h3 className="text-xl font-semibold text-white mb-6">Send a Message</h3>
              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label="Name"
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Your name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
                <Input
                  label="Email"
                  id="email"
                  name="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
                <Textarea
                  label="Message"
                  id="message"
                  name="message"
                  rows={4}
                  placeholder="Tell me about your project..."
                  value={formData.message}
                  onChange={handleInputChange}
                  required
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full"
                >
                  Send Message
                  <ArrowRight className="ml-2" size={16} />
                </Button>
              </form>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
