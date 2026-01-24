import Navigation from '@/components/layout/Navigation';
import Hero from '@/components/sections/Hero';
import Ventures from '@/components/sections/Ventures';
import About from '@/components/sections/About';
import Contact from '@/components/sections/Contact';
import Footer from '@/components/layout/Footer';

export default function Home() {
  return (
    <main className="min-h-screen bg-black">
      <Navigation />
      <Hero />
      <Ventures />
      <About />
      <Contact />
      <Footer />
    </main>
  );
}
