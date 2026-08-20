import React, { useState } from 'react';
import { Check, Info, Zap, Crown, Shield, Rocket, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';


const Pricing = () => {
  const navigate = useNavigate();
  const { user, openAuthModal, refreshUser } = useAuth();
  const [hoveredCard, setHoveredCard] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('idle'); // idle | loading | success | error
  const [message, setMessage] = useState('');
  const [processingPlanId, setProcessingPlanId] = useState(null);

  const plans = [
    {
      id: 'free',
      name: 'Explorer',
      price: '0',
      credits: '100',
      icon: Sparkles,
      color: 'from-gray-400 to-gray-500',
      shadow: 'hover:shadow-gray-500/20',
      features: [
        '100 credits / month (auto reset)',
        'Model Builder: max 5 runs/month',
        'Standard processing speed',
        'Limited dataset size',
        <span key="no-export" className="text-gray-500 line-through">Model export</span>,
        <span key="no-commercial" className="text-gray-500 line-through">Commercial usage</span>
      ],
      cta: 'Start Free',
      ctaStyle: 'bg-white/10 hover:bg-white/20 text-white'
    },
    {
      id: 'starter',
      name: 'Starter',
      price: '99',
      credits: '300',
      icon: Rocket,
      color: 'from-green-400 to-emerald-600',
      shadow: 'hover:shadow-emerald-500/20',
      popular: false,
      features: [
        '300 credits / month',
        'Unlimited model builds',
        'Faster processing',
        'Save projects',
        'Commercial usage enabled'
      ],
      cta: 'Upgrade to Starter',
      ctaStyle: 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/50'
    },
    {
      id: 'builder',
      name: 'Builder',
      price: '199',
      credits: '600',
      icon: Zap,
      color: 'from-blue-400 to-cyan-600',
      shadow: 'hover:shadow-cyan-500/30',
      popular: true,
      features: [
        'Advanced cleaning options',
        'Deeper web extraction',
        'Model comparison',
        'Priority queue execution'
      ],
      cta: 'Upgrade to Builder',
      ctaStyle: 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/25'
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '499',
      credits: '1500',
      icon: Shield,
      color: 'from-purple-400 to-violet-600',
      shadow: 'hover:shadow-violet-500/20',
      popular: false,
      features: [
        'Advanced ML models',
        'Hyperparameter tuning',
        'Model export functionality',
        'Dataset versioning',
        'Deep Learning (PyTorch) - 60 credits/run',
        'NLP Transformers - 40 credits/run'
      ],
      cta: 'Go Pro',
      ctaStyle: 'bg-violet-500/20 text-violet-400 hover:bg-violet-500 hover:text-white border border-violet-500/50'
    },
    {
      id: 'ultra',
      name: 'ULTRA',
      price: '999',
      credits: '3000',
      icon: Crown,
      color: 'from-red-400 to-rose-600',
      shadow: 'hover:shadow-rose-500/30',
      popular: false,
      features: [
        'No dataset limits',
        'Fastest execution queue',
        'Premium support & SLA',
        'Early access features',
        'Serverless GPU AutoML (DL & NLP) enabled'
      ],
      cta: 'Unlock Ultra',
      ctaStyle: 'bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-400 hover:to-rose-500 shadow-lg shadow-rose-500/25 border border-rose-400/50'
    }
  ];

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSubscribe = async (plan) => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (plan.id === 'free') {
      navigate('/dashboard');
      return;
    }

    setPaymentStatus('idle');
    setMessage('');
    setIsProcessing(true);
    setProcessingPlanId(plan.id);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

      const token = localStorage.getItem('auth_token');
      // 1. Create order on the backend with 15s timeout
      const { data: orderData } = await axios.post('/api/payments/create-order', 
        { planId: plan.id },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
      );

      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Datalyze',
        description: `Upgrade to ${plan.name} Plan`,
        image: 'https://ui-avatars.com/api/?name=Datalyze&background=6366f1&color=fff&bold=true',
        order_id: orderData.id,
        handler: async (response) => {
          setIsProcessing(true);
          setPaymentStatus('loading');
          setMessage('Verifying payment signature...');
          try {
            const verifyPayload = {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planId: plan.id
            };
            
            await axios.post('/api/payments/verify', verifyPayload, {
              headers: { Authorization: `Bearer ${token}` }, timeout: 15000
            });

            // Sync user data to refresh credits/plan
            await refreshUser();

            setPaymentStatus('success');
            setMessage(`Payment successful! Your plan has been upgraded to ${plan.name} and ${plan.credits} credits have been added.`);
            
            // Auto-hide success message after 5 seconds
            setTimeout(() => {
              setPaymentStatus('idle');
              setMessage('');
            }, 5000);

          } catch (err) {
            console.error("Payment verification failed:", err);
            const detail = err?.response?.data?.detail || 'Signature verification failed. Please contact support.';
            setPaymentStatus('error');
            setMessage(detail);
          } finally {
            setIsProcessing(false);
            setProcessingPlanId(null);
          }
        },
        prefill: {
          name: user.name || '',
          email: user.email || '',
        },
        theme: {
          color: '#6366f1',
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            setProcessingPlanId(null);
            setPaymentStatus('error');
            setMessage('Payment cancelled by user.');
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (err) {
      console.error("Order creation failed:", err);
      const detail = err?.response?.data?.detail || err.message || 'Failed to initiate payment. Please try again.';
      setPaymentStatus('error');
      setMessage(detail);
      setIsProcessing(false);
      setProcessingPlanId(null);
    }
  };

  return (
    <div className="min-h-screen py-16 px-4 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary-500/10 blur-[120px] -z-10 rounded-full"></div>
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/10 blur-[100px] -z-10 rounded-full"></div>

      <div className="max-w-7xl mx-auto">
        {/* Payment Processing/Success/Error Banners */}
        {paymentStatus === 'loading' && (
          <div className="max-w-3xl mx-auto mb-8 p-4 bg-primary-500/10 border border-primary-500/20 text-primary-400 rounded-2xl flex items-center gap-3 animate-pulse">
            <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />
            <div className="text-sm font-medium">{message}</div>
          </div>
        )}
        {paymentStatus === 'success' && (
          <div className="max-w-3xl mx-auto mb-8 p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-2xl flex items-center gap-3 animate-fade-in">
            <Check className="w-5 h-5 flex-shrink-0" />
            <div className="text-sm font-medium">{message}</div>
          </div>
        )}
        {paymentStatus === 'error' && (
          <div className="max-w-3xl mx-auto mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center gap-3 animate-fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div className="text-sm font-medium">{message}</div>
          </div>
        )}
        <div className="text-center max-w-3xl mx-auto mb-16 px-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 font-mono text-sm mb-6">
            Usage-based &middot; Credit-driven &middot; No hidden fees
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 tracking-tight leading-tight">
            Plans &amp; Pricing Built for Builders
          </h1>
          <p className="text-xl font-semibold text-gray-200 mb-4">
            Simple, transparent pricing — pay only for what works.
          </p>
          <div className="text-base text-gray-400 space-y-1">
            <p>Credits are deducted only after successful execution.</p>
            <p>Failed operations are never charged.</p>
            <p>Credits reset monthly.</p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-6 items-stretch">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            const isHovered = hoveredCard === index;
            
            return (
              <div 
                key={plan.name}
                onMouseEnter={() => setHoveredCard(index)}
                onMouseLeave={() => setHoveredCard(null)}
                className={`relative flex flex-col w-full md:w-[320px] p-1 rounded-3xl transition-all duration-300 ${plan.popular ? 'transform md:-translate-y-4' : ''} ${isHovered ? 'transform -translate-y-2' : ''}`}
              >
                {/* Gradient Border Trick */}
                <div className={`absolute inset-0 rounded-3xl opacity-20 bg-gradient-to-b ${plan.color} ${isHovered ? 'opacity-50' : ''} transition-opacity`}></div>
                
                <div className={`relative h-full flex flex-col p-8 bg-[#0A0F1E]/90 backdrop-blur-xl rounded-[23px] border border-white/10 ${plan.shadow} transition-shadow`}>
                  
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-1 rounded-full text-xs font-bold tracking-wide shadow-lg shadow-cyan-500/20">
                      MOST POPULAR
                    </div>
                  )}

                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br ${plan.color} bg-opacity-10 shadow-inner`}>
                    <Icon className="w-7 h-7 text-white" />
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline mb-6">
                    <span className="text-gray-400 text-2xl mr-1 font-light">₹</span>
                    <span className="text-4xl font-extrabold text-white tracking-tighter">{plan.price}</span>
                    <span className="text-gray-500 ml-2">/ month</span>
                  </div>

                  <div className="flex items-center gap-2 mb-8 p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${plan.color} animate-pulse`}></div>
                    <span className="text-white font-medium">{plan.credits} Credits</span>
                  </div>

                  <ul className="space-y-4 mb-8 flex-grow">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start text-sm text-gray-300">
                        <Check className="w-4 h-4 text-primary-400 mr-3 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button 
                    onClick={() => handleSubscribe(plan)}
                    disabled={isProcessing}
                    className={`w-full py-3 rounded-xl font-semibold transition-all duration-200 mt-auto flex items-center justify-center gap-2 ${plan.ctaStyle} ${isProcessing ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    {isProcessing && processingPlanId === plan.id ? (
                      <>
                        <span className="btn-spinner"></span>
                        <span>Processing...</span>
                      </>
                    ) : (
                      plan.cta
                    )}
                  </button>
                  {isProcessing && processingPlanId === plan.id && (
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-3 relative">
                      <div className="absolute top-0 bottom-0 left-0 bg-primary-500 skeleton-shimmer" style={{ width: '45%' }}></div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature Cost breakdown */}
        <div className="mt-24 p-8 rounded-3xl bg-white/5 border border-white/10 max-w-4xl mx-auto backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-8">
            <Info className="w-6 h-6 text-primary-400" />
            <h3 className="text-2xl font-bold text-white">Feature Cost Breakdown</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: 'Dataset Search', cost: '0' },
              { name: 'Understand Dataset (EDA)', cost: '2' },
              { name: 'Clean Dataset', cost: '3' },
              { name: 'Generate Dataset', cost: '3' },
              { name: 'Web Extract (Basic)', cost: '2' },
              { name: 'Web Extract (Deep Scrape)', cost: '3' },
              { name: 'Model Builder (CPU Train)', cost: '10' },
              { name: 'Model Builder (Deep Learning)', cost: '60' },
              { name: 'Model Builder (NLP Transformers)', cost: '40' },
              { name: 'Download Dataset', cost: '2' },
            ].map((f) => (
              <div key={f.name} className="flex justify-between items-center p-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors rounded-lg">
                <span className="text-gray-300">{f.name}</span>
                <span className="text-white font-medium px-3 py-1 bg-white/10 rounded-full text-sm">
                  {f.cost} Credits
                </span>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-400 mt-6 text-center font-medium">
            * Credits are deducted ONLY after successful execution.<br />
            * Failed tasks are refunded automatically.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
