'use client';

import { useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Mail, Linkedin, Twitter, Github, ArrowRight } from 'lucide-react';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import GridBackground from '@/components/ui/GridBackground';
import { socialLinks } from '@/lib/data';
import { fadeInUp, staggerContainer, staggerContainerFast, viewportSettings } from '@/lib/animations';

const iconMap = {
  mail: Mail,
  linkedin: Linkedin,
  twitter: Twitter,
  github: Github,
};

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });

  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const accentY = useTransform(scrollYProgress, [0, 1], [40, -40]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
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

  return (
    <section ref={sectionRef} id="contact" className="relative py-32 bg-[#050505] overflow-hidden">
      {/* Background elements */}
      <GridBackground variant="dots" fade="radial" intensity="dim" />

      {/* Accent gradient with parallax */}
      <motion.div
        className="absolute bottom-0 right-0 w-[600px] h-[600px] opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(0, 240, 255, 0.1) 0%, transparent 70%)',
          y: accentY,
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          whileInView="animate"
          viewport={viewportSettings}
          className="mb-20"
        >
          <div className="flex items-center gap-4 mb-6">
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#00F0FF]">
              03
            </span>
            <div className="h-px bg-[#00F0FF]/30 w-16" />
          </div>
          <h2 className="font-display text-5xl md:text-6xl lg:text-7xl text-[#FAFAFA] mb-6 leading-[1.1]">
            Get in Touch
          </h2>
          <p className="text-lg md:text-xl text-[#888888] max-w-2xl leading-relaxed">
            Ready to build something amazing together?
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={viewportSettings}
          className="grid grid-cols-1 lg:grid-cols-2 gap-16"
        >
          {/* Left Column - Info */}
          <motion.div variants={fadeInUp} className="space-y-12">
            <div>
              <p className="text-[#888888] text-lg leading-relaxed mb-8">
                Interested in connecting? I&apos;m always open to discussing new projects, investment opportunities, or strategic partnerships.
              </p>
            </div>

            {/* Social Links with spring physics */}
            <div className="space-y-4">
              {socialLinks.map((link) => {
                const Icon = iconMap[link.icon];
                return Icon ? (
                  <motion.a
                    key={link.label}
                    href={link.href}
                    target={link.href.startsWith('http') ? '_blank' : undefined}
                    rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="flex items-center gap-6 group py-4 border-b border-[#1F1F1F] hover:border-[#00F0FF]/30 transition-colors duration-300"
                    whileHover={{ x: 12 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <motion.div
                      className="w-12 h-12 flex items-center justify-center bg-[#0C0C0C] border border-[#2A2A2A] group-hover:border-[#00F0FF]/50 group-hover:bg-[#00F0FF]/5 transition-all duration-300"
                      whileHover={{
                        boxShadow: "0 0 20px rgba(0, 240, 255, 0.15)",
                      }}
                    >
                      <Icon size={20} className="text-[#555555] group-hover:text-[#00F0FF] transition-colors duration-300" />
                    </motion.div>
                    <div className="flex-grow">
                      <span className="text-[#FAFAFA] group-hover:text-[#00F0FF] transition-colors duration-300">
                        {link.label}
                      </span>
                    </div>
                    <ArrowRight
                      size={16}
                      className="text-[#333333] group-hover:text-[#00F0FF] transition-all duration-300 group-hover:translate-x-1"
                    />
                  </motion.a>
                ) : null;
              })}
            </div>
          </motion.div>

          {/* Right Column - Form with stagger */}
          <motion.div variants={fadeInUp}>
            <div className="border border-[#1F1F1F] bg-[#0C0C0C] p-8 md:p-10">
              {/* Form header */}
              <div className="flex items-center gap-3 mb-10">
                <div className="w-2 h-2 bg-[#FFB800]" />
                <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-[#888888]">
                  Send a Message
                </h3>
              </div>

              <motion.form
                onSubmit={handleSubmit}
                className="space-y-8"
                variants={staggerContainerFast}
                initial="initial"
                whileInView="animate"
                viewport={viewportSettings}
              >
                <motion.div variants={fadeInUp}>
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
                </motion.div>
                <motion.div variants={fadeInUp}>
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
                </motion.div>
                <motion.div variants={fadeInUp}>
                  <Textarea
                    label="Message"
                    id="message"
                    name="message"
                    rows={5}
                    placeholder="Tell me about your project..."
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                  />
                </motion.div>
                <motion.div variants={fadeInUp}>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    icon="arrow"
                    className="w-full"
                  >
                    Send Message
                  </Button>
                </motion.div>
              </motion.form>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
