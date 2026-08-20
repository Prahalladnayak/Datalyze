import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, ChevronLeft, CreditCard, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import WaveLoader from '../components/WaveLoader';

const Checkout = () => {
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('plan') || 'starter';
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const planDetails = {
    starter: { name: 'Starter', price: '99', credits: 300 },
    builder: { name: 'Builder', price: '199', credits: 600 },
    pro: { name: 'Pro', price: '499', credits: 1500 },
    ultra: { name: 'ULTRA', price: '999', credits: 3000 },
  };

  const selectedPlan = planDetails[planId] || planDetails.starter;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handlePayment = (e) => {
    e.preventDefault();
    setIsProcessing(true);

    // Payment gateway not yet integrated.
    // DO NOT grant credits or upgrade plan here.
    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
      // updatePlan() intentionally NOT called — real payment required first.
    }, 1200);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-[#0A0F1E] border border-amber-500/20 rounded-3xl p-10 text-center max-w-md w-full shadow-2xl shadow-amber-500/10">
          <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Subscription Pending</h2>
          <p className="text-gray-400 mb-2">
            Payment integration is coming soon.
          </p>
          <p className="text-amber-400/80 text-sm font-medium bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-6">
            Plan activation pending. Your current plan and credits remain unchanged until payment is confirmed.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-primary-400 underline hover:text-primary-300 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="max-w-5xl mx-auto">
        
        <button 
          onClick={() => navigate('/pricing')}
          className="flex items-center text-gray-400 hover:text-white transition-colors mb-8"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          Back to Pricing
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Checkout Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#0A0F1E] border border-white/10 rounded-3xl p-8 isolate relative overflow-hidden">
               <h2 className="text-2xl font-bold text-white mb-6">Checkout Details</h2>
               
               <form id="checkout-form" onSubmit={handlePayment} className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-sm font-medium text-gray-400">First Name</label>
                       <input required type="text" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500" placeholder="John" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-sm font-medium text-gray-400">Last Name</label>
                       <input required type="text" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500" placeholder="Doe" />
                    </div>
                 </div>
                 
                 <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-400">Email Address</label>
                    <input required type="email" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500" placeholder="john@example.com" />
                 </div>

                 <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-400">Organization (Optional)</label>
                    <input type="text" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500" placeholder="Acme Inc" />
                 </div>
               </form>
            </div>

            <div className="bg-[#0A0F1E] border border-white/10 rounded-3xl p-8 text-center text-gray-400 flex flex-col items-center justify-center min-h-[150px]">
                <CreditCard className="w-8 h-8 opacity-50 mb-3" />
                <p>Payment logic (Stripe/Razorpay) is currently in test mode.</p>
                <p className="text-sm mt-1">Click below to simulate payment.</p>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-primary-900/10 border border-primary-500/20 rounded-3xl p-8 sticky top-24">
               <h3 className="text-xl font-bold text-white mb-6">Order Summary</h3>
               
               <div className="flex justify-between items-center mb-4">
                 <div className="flex flex-col">
                   <span className="text-white font-medium">{selectedPlan.name} Plan</span>
                   <span className="text-sm text-gray-400">Monthly billing</span>
                 </div>
                 <span className="text-xl font-bold text-white">₹{selectedPlan.price}</span>
               </div>

               <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
                 <div className="flex items-start justify-between text-sm">
                   <span className="text-gray-400">Credits Included:</span>
                   <span className="text-white font-medium text-right bg-white/10 px-2 py-0.5 rounded">{selectedPlan.credits} / mo</span>
                 </div>
                 <div className="flex items-start justify-between text-sm">
                   <span className="text-gray-400">Subtotal:</span>
                   <span className="text-white font-medium">₹{selectedPlan.price}</span>
                 </div>
                 <div className="flex items-start justify-between text-sm">
                   <span className="text-gray-400">Taxes (18% GST):</span>
                   <span className="text-white font-medium">₹{(selectedPlan.price * 0.18).toFixed(2)}</span>
                 </div>
               </div>

               <div className="mt-6 pt-6 border-t border-white/10">
                 <div className="flex items-center justify-between mb-8">
                   <span className="text-lg font-bold text-white">Total Due</span>
                   <span className="text-2xl font-bold text-primary-400">₹{(selectedPlan.price * 1.18).toFixed(2)}</span>
                 </div>
                 
                 <button 
                  form="checkout-form"
                  type="submit"
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white shadow-lg shadow-primary-500/25 transition-all font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {isProcessing ? (
                     <WaveLoader size="sm" />
                   ) : (
                     <>
                      <Lock className="w-4 h-4" />
                      Continue to Payment
                     </>
                   )}
                 </button>
               </div>
               
               <div className="flex items-center justify-center gap-2 mt-6 text-xs text-gray-500">
                 <ShieldCheck className="w-4 h-4" />
                 Secure 256-bit encryption
               </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Checkout;
