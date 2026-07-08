import { useState, useEffect } from 'react';
import { BookingModal } from './BookingModel';
interface ServiceOption {
  duration: string;
  price: number;
}

interface Service {
  name: string;
  description: string;
  icon: string;
  options: ServiceOption[];
}

const galleryImages = [
  "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=400&h=300&fit=crop",
];

const timeSlots = [
  '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'
];

interface ChiChisSpaProps {
  services: Service[];
  homeCallFee: number;
}

export function ChiChisSpa({ services, homeCallFee }: ChiChisSpaProps) {
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedOption, setSelectedOption] = useState<ServiceOption | null>(null);
  const [isHomeCall, setIsHomeCall] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const totalPrice = selectedOption
    ? selectedOption.price + (isHomeCall ? homeCallFee : 0)
    : 0;

  const handleBooking = () => {
    if (selectedService && selectedOption) {
      setShowBooking(true);
    }
  };

  const confirmBooking = () => {
    setBookingConfirmed(true);
    setTimeout(() => {
      setShowBooking(false);
      setBookingConfirmed(false);
      setSelectedService(null);
      setSelectedOption(null);
      setCustomerName('');
      setCustomerPhone('');
      setBookingDate('');
      setBookingTime('');
    }, 3000);
  };

  const scrollToServices = () => {
    document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden font-montserrat">
      {/* Floating Glow Orbs */}
      <div className="glow-orb bg-[#f48fb1] w-96 h-96 -top-48 -left-48 fixed" style={{ animationDelay: '0s' }} />
      <div className="glow-orb bg-[#ce93d8] w-80 h-80 top-1/2 -right-40 fixed" style={{ animationDelay: '2s' }} />
      <div className="glow-orb bg-[#f48fb1] w-64 h-64 bottom-20 left-1/4 fixed" style={{ animationDelay: '4s' }} />

      {/* Noise Overlay */}
      <div className="noise-overlay" />

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-[#0a0a0a]/90 backdrop-blur-xl py-4' : 'py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f48fb1] to-[#ce93d8] flex items-center justify-center text-white font-bold text-sm">CC</div>
            <span className="font-playfair text-xl tracking-wide">Chi Chi's</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm tracking-wider">
            <a href="#services" className="text-white/70 hover:text-[#f48fb1] transition-colors">Services</a>
            <a href="#gallery" className="text-white/70 hover:text-[#f48fb1] transition-colors">Gallery</a>
            <a href="#contact" className="text-white/70 hover:text-[#f48fb1] transition-colors">Contact</a>
          </div>
          <button 
            onClick={scrollToServices}
            className="px-6 py-2.5 bg-[#f48fb1] text-[#0a0a0a] text-sm font-semibold rounded-full hover:bg-[#f8bbd9] transition-all hover:scale-105"
          >
            Book Now
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0a]/50 to-[#0a0a0a]" />
          <img 
            src="https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1920&h=1080&fit=crop" 
            alt="Spa ambiance" 
            className="w-full h-full object-cover opacity-40"
          />
        </div>
        
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <span className="inline-block px-4 py-1.5 text-xs tracking-[0.3em] uppercase text-[#f48fb1] border border-[#f48fb1]/30 rounded-full mb-8">
              Premium Wellness Experience
            </span>
          </div>
          
          <h1 className="font-playfair text-5xl md:text-7xl lg:text-8xl font-medium mb-6 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <span className="text-gradient">Chi Chi's</span>
            <br />
            <span className="text-white">Beauty Spa</span>
          </h1>
          
          <p className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto mb-12 font-light leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
            Indulge in luxury treatments designed to restore your body, 
            rejuvenate your spirit, and awaken your inner radiance.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
            <button 
              onClick={scrollToServices}
              className="group px-8 py-4 bg-[#f48fb1] text-[#0a0a0a] font-semibold rounded-full animate-pulse-glow hover:bg-[#f8bbd9] transition-all hover:scale-105 flex items-center gap-3"
            >
              <span>Book Your Experience</span>
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </button>
            <a 
              href="https://wa.me/27633923033"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 border border-white/20 text-white rounded-full hover:bg-white/5 transition-all flex items-center gap-3"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <span>WhatsApp Us</span>
            </a>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/40 animate-bounce">
          <span className="text-xs tracking-widest uppercase">Scroll</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* Features Strip */}
      <section className="py-16 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { icon: '✧', label: 'Premium Products', desc: 'Only the finest oils' },
              { icon: '◈', label: 'Expert Therapists', desc: 'Certified professionals' },
              { icon: '❋', label: 'Home Service', desc: 'We come to you' },
              { icon: '♡', label: 'Personalized Care', desc: 'Tailored treatments' },
            ].map((feature, i) => (
              <div key={i} className="group">
                <div className="text-3xl text-[#f48fb1] mb-3 group-hover:scale-110 transition-transform">{feature.icon}</div>
                <h3 className="font-semibold text-white mb-1">{feature.label}</h3>
                <p className="text-white/50 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-[#f48fb1] text-sm tracking-[0.3em] uppercase">Our Treatments</span>
            <h2 className="font-playfair text-4xl md:text-5xl mt-4 mb-6">Signature Services</h2>
            <p className="text-white/50 max-w-2xl mx-auto">Select your desired treatment and duration below. Each experience is crafted to deliver the ultimate in relaxation and rejuvenation.</p>
          </div>

          {/* Home Call Toggle */}
          <div className="flex justify-center mb-12">
            <div className="gradient-border rounded-full p-1 flex items-center gap-4">
              <span className={`px-6 py-3 rounded-full transition-all cursor-pointer ${!isHomeCall ? 'bg-[#f48fb1] text-[#0a0a0a] font-semibold' : 'text-white/60'}`} onClick={() => setIsHomeCall(false)}>
                Visit Our Spa
              </span>
              <button
                onClick={() => setIsHomeCall(!isHomeCall)}
                className={`relative w-14 h-7 rounded-full transition-colors ${isHomeCall ? 'bg-[#f48fb1]' : 'bg-white/20'}`}
              >
                <span className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-lg ${isHomeCall ? 'left-8' : 'left-1'}`} />
              </button>
              <span className={`px-6 py-3 rounded-full transition-all cursor-pointer ${isHomeCall ? 'bg-[#f48fb1] text-[#0a0a0a] font-semibold' : 'text-white/60'}`} onClick={() => setIsHomeCall(true)}>
                Home Service (+R{homeCallFee})
              </span>
            </div>
          </div>

          {/* Services Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, index) => (
              <div 
                key={index}
                className={`gradient-border rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2 cursor-pointer ${
                  selectedService?.name === service.name ? 'ring-2 ring-[#f48fb1]' : ''
                }`}
                onClick={() => {
                  setSelectedService(service);
                  setSelectedOption(null);
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-3xl text-[#f48fb1]">{service.icon}</span>
                  {selectedService?.name === service.name && (
                    <span className="text-xs bg-[#f48fb1]/20 text-[#f48fb1] px-3 py-1 rounded-full">Selected</span>
                  )}
                </div>
                <h3 className="font-playfair text-xl mb-2">{service.name}</h3>
                <p className="text-white/50 text-sm mb-6 leading-relaxed">{service.description}</p>
                
                <div className="flex flex-wrap gap-2">
                  {service.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedService(service);
                        setSelectedOption(opt);
                      }}
                      className={`flex-1 min-w-[80px] p-3 rounded-xl border transition-all ${
                        selectedService?.name === service.name && selectedOption?.duration === opt.duration
                          ? 'bg-[#f48fb1] border-[#f48fb1] text-[#0a0a0a]'
                          : 'border-white/10 hover:border-[#f48fb1]/50 hover:bg-white/5'
                      }`}
                    >
                      <span className="block text-xs uppercase tracking-wider opacity-70">{opt.duration}</span>
                      <span className="block text-lg font-semibold mt-1">R{opt.price}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Booking Summary Bar */}
          {selectedService && selectedOption && (
            <div className="fixed bottom-0 left-0 right-0 bg-[#121212]/95 backdrop-blur-xl border-t border-white/10 p-4 z-40 animate-scale-in">
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <p className="text-white/60 text-sm">Selected Treatment</p>
                  <p className="font-playfair text-lg">
                    {selectedService.name} <span className="text-[#f48fb1]">• {selectedOption.duration}</span>
                    {isHomeCall && <span className="text-white/40 text-sm ml-2">(Home Service)</span>}
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-white/60 text-sm">Total</p>
                    <p className="text-2xl font-semibold text-gradient">R{totalPrice}</p>
                  </div>
                  <button 
                    onClick={handleBooking}
                    className="px-8 py-3 bg-[#f48fb1] text-[#0a0a0a] font-semibold rounded-full hover:bg-[#f8bbd9] transition-all hover:scale-105"
                  >
                    Continue to Book
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Gallery Section */}
      <section id="gallery" className="py-24 bg-[#0d0d0d]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-[#f48fb1] text-sm tracking-[0.3em] uppercase">Experience</span>
            <h2 className="font-playfair text-4xl md:text-5xl mt-4">Our Sanctuary</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {galleryImages.map((img, i) => (
              <div 
                key={i} 
                className={`relative overflow-hidden rounded-2xl group ${i === 0 ? 'md:col-span-2 md:row-span-2' : ''}`}
              >
                <img 
                  src={img} 
                  alt={`Spa gallery ${i + 1}`}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  style={{ minHeight: i === 0 ? '400px' : '200px' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a]/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <span className="text-[#f48fb1] text-sm tracking-[0.3em] uppercase">Testimonials</span>
          <h2 className="font-playfair text-4xl md:text-5xl mt-4 mb-16">What Clients Say</h2>
          
          <div className="gradient-border rounded-3xl p-8 md:p-12">
            <div className="text-[#f48fb1] text-5xl mb-6">"</div>
            <p className="font-playfair text-xl md:text-2xl italic text-white/80 leading-relaxed mb-8">
              The most incredible spa experience I've ever had. Chi Chi's attention to detail and the luxurious atmosphere made me feel like royalty. I'll definitely be returning!
            </p>
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#f48fb1] to-[#ce93d8] flex items-center justify-center text-white font-semibold">NM</div>
              <div className="text-left">
                <p className="font-semibold">Nomvula M.</p>
                <p className="text-white/50 text-sm">Fish Hoek</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 bg-[#0d0d0d]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-[#f48fb1] text-sm tracking-[0.3em] uppercase">Get in Touch</span>
              <h2 className="font-playfair text-4xl md:text-5xl mt-4 mb-6">Visit Our Spa</h2>
              <p className="text-white/60 mb-8 leading-relaxed">
                Whether you prefer the tranquility of our spa sanctuary or the convenience of our home service, 
                we're here to provide you with an unforgettable wellness experience.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#f48fb1]/10 flex items-center justify-center text-[#f48fb1]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white/50 text-sm">Phone / WhatsApp</p>
                    <a href="tel:0633923033" className="text-lg hover:text-[#f48fb1] transition-colors">063 392 3033</a>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#f48fb1]/10 flex items-center justify-center text-[#f48fb1]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white/50 text-sm">Operating Hours</p>
                    <p className="text-lg">Mon - Sun: 9:00 AM - 7:00 PM</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#f48fb1]/10 flex items-center justify-center text-[#f48fb1]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white/50 text-sm">Location</p>
                    <p className="text-lg">Fish Hoek, South Africa</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="gradient-border rounded-3xl p-8">
                <h3 className="font-playfair text-2xl mb-6">Quick Enquiry</h3>
                <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                  <input 
                    type="text" 
                    placeholder="Your Name"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-[#f48fb1]/50 transition-colors"
                  />
                  <input 
                    type="tel" 
                    placeholder="Phone Number"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-[#f48fb1]/50 transition-colors"
                  />
                  <textarea 
                    placeholder="Your Message"
                    rows={4}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-[#f48fb1]/50 transition-colors resize-none"
                  />
                  <button 
                    type="submit"
                    className="w-full py-4 bg-[#f48fb1] text-[#0a0a0a] font-semibold rounded-xl hover:bg-[#f8bbd9] transition-all"
                  >
                    Send Message
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f48fb1] to-[#ce93d8] flex items-center justify-center text-white font-bold text-sm">CC</div>
              <span className="font-playfair text-xl">Chi Chi's Beauty Spa</span>
            </div>
            <p className="text-white/40 text-sm">© 2025 Chi Chi's Beauty Spa. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-[#f48fb1]/20 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-[#f48fb1]/20 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
              </a>
              <a href="https://wa.me/27633923033" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-[#f48fb1]/20 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      <a 
        href="https://wa.me/27633923033?text=Hi%20Chi%20Chi's!%20I'd%20like%20to%20book%20an%20appointment."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-24 right-6 z-50 w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform group"
      >
        <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        <span className="absolute right-full mr-3 px-3 py-1.5 bg-white text-[#0a0a0a] text-sm font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
          Chat with us!
        </span>
      </a>
       
     <BookingModal
      isOpen={showBooking}
      onClose={() => setShowBooking(false)}
      selectedService={selectedService}
      selectedOption={selectedOption}
      isHomeCall={isHomeCall}
      homeCallFee={homeCallFee}
     />
      {/* Booking Modal 
      {showBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in-up">
          <div className="gradient-border rounded-3xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-in">
            {bookingConfirmed ? (
              <div className="text-center py-8">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#f48fb1]/20 flex items-center justify-center">
                  <svg className="w-10 h-10 text-[#f48fb1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-playfair text-2xl mb-2">Booking Confirmed!</h3>
                <p className="text-white/60">We'll contact you shortly to confirm your appointment.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-playfair text-2xl">Complete Your Booking</h3>
                  <button 
                    onClick={() => setShowBooking(false)}
                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="bg-white/5 rounded-xl p-4 mb-6">
                  <p className="text-white/50 text-sm mb-1">Selected Treatment</p>
                  <p className="font-semibold">{selectedService?.name}</p>
                  <p className="text-[#f48fb1]">{selectedOption?.duration} • R{totalPrice} {isHomeCall && '(incl. home service)'}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Your Name</label>
                    <input 
                      type="text" 
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-[#f48fb1]/50 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-white/60 mb-2">Phone Number</label>
                    <input 
                      type="tel" 
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="e.g. 063 123 4567"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-[#f48fb1]/50 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-white/60 mb-2">Preferred Date</label>
                    <input 
                      type="date" 
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-[#f48fb1]/50 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-white/60 mb-2">Preferred Time</label>
                    <div className="grid grid-cols-3 gap-2">
                      {timeSlots.map((time) => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => setBookingTime(time)}
                          className={`py-2 rounded-lg border transition-all ${
                            bookingTime === time 
                              ? 'bg-[#f48fb1] border-[#f48fb1] text-[#0a0a0a] font-semibold' 
                              : 'border-white/10 hover:border-[#f48fb1]/50'
                          }`}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={confirmBooking}
                    disabled={!customerName || !customerPhone || !bookingDate || !bookingTime}
                    className="w-full py-4 bg-[#f48fb1] text-[#0a0a0a] font-semibold rounded-xl hover:bg-[#f8bbd9] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                  >
                    Confirm Booking
                  </button>
                  
                  <p className="text-center text-white/40 text-sm">
                    You'll receive a confirmation via WhatsApp
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}*/}
    </div>
  );
}