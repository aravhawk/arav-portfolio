import Navigation from '@/components/layout/Navigation';
import Hero from '@/components/sections/Hero';
import Ventures from '@/components/sections/Ventures';
import About from '@/components/sections/About';
import Contact from '@/components/sections/Contact';
import Footer from '@/components/layout/Footer';
import CustomCursor from '@/components/ui/CustomCursor';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#050505]">
      {/* Custom cursor */}
      <CustomCursor />

      {/* Noise overlay */}
      <div className="noise-overlay" />

      {/* Content */}
      <Navigation />
      <Hero />
      <Ventures />
      <About />
      <Contact />
      <Footer />
    </main>
  );
}
