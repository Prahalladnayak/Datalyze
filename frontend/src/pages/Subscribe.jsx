import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, User, Mail, Tag, CreditCard, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const PLANS = [
    { id: 'starter',  label: 'Starter',  price: '₹99/mo',   credits: 300  },
    { id: 'builder',  label: 'Builder',  price: '₹199/mo',  credits: 600  },
    { id: 'pro',      label: 'Pro',      price: '₹499/mo',  credits: 1500 },
    { id: 'ultra',    label: 'ULTRA',    price: '₹999/mo',  credits: 3000 },
];

const STEPS = ['Your Details', 'Plan Confirmation', 'Review & Confirm'];

const Subscribe = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const params = new URLSearchParams(location.search);
    const defaultPlan = params.get('plan') || 'starter';

    const [step, setStep] = useState(0);
    const [form, setForm] = useState({
        name: '',
        email: '',
        plan: defaultPlan,
        billing: 'monthly',
    });
    const { updatePlan } = useAuth();
    const [submitted, setSubmitted] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const selectedPlan = PLANS.find(p => p.id === form.plan) || PLANS[0];

    const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

    const canNext = () => {
        if (step === 0) return form.name.trim() && form.email.trim();
        if (step === 1) return !!form.plan;
        return true;
    };

    const handleNext = () => {
        if (step < STEPS.length - 1) {
            setStep(s => s + 1);
        } else {
            setIsProcessing(true);
            setTimeout(() => {
                updatePlan(selectedPlan.label, selectedPlan.credits);
                setIsProcessing(false);
                setSubmitted(true);
            }, 1500);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center p-4">
                <div className="text-center max-w-sm">
                    <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-5">
                        <CheckCircle2 className="w-10 h-10 text-green-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Request Received</h2>
                    <p className="text-gray-400 mb-1">Welcome aboard, <span className="text-white font-semibold">{form.name}</span>!</p>
                    <p className="text-sm text-gray-500 mb-6">
                        Your <span className="text-primary-400 font-semibold">{selectedPlan.label}</span> plan is queued for activation.
                        A confirmation will be sent to <span className="text-white">{form.email}</span>.
                    </p>
                    <Link to="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-primary-500/20">
                        Go to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
            <div className="w-full max-w-lg">

                {/* Back link */}
                <button onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/pricing')}
                    className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-6 transition-colors group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    {step > 0 ? 'Back' : 'Back to Pricing'}
                </button>

                {/* Step progress */}
                <div className="flex items-center gap-2 mb-8">
                    {STEPS.map((label, i) => (
                        <React.Fragment key={label}>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                    i < step ? 'bg-green-500 text-white' :
                                    i === step ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30' :
                                    'bg-white/5 border border-white/10 text-gray-500'
                                }`}>
                                    {i < step ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                                </div>
                                <span className={`text-xs font-semibold hidden sm:block ${i === step ? 'text-white' : 'text-gray-500'}`}>
                                    {label}
                                </span>
                            </div>
                            {i < STEPS.length - 1 && (
                                <div className={`flex-1 h-px ${i < step ? 'bg-green-500/40' : 'bg-white/10'}`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                <div className="bg-[#0A0F1E] border border-white/10 rounded-3xl p-7 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-primary-600 via-purple-500 to-primary-600" />
                    <div className="absolute top-0 right-0 w-60 h-60 bg-primary-500/10 blur-[80px] -z-10 rounded-full" />

                    {/* Step 0 — Your Details */}
                    {step === 0 && (
                        <div className="space-y-5">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-1">Your Details</h2>
                                <p className="text-sm text-gray-400">Step 1 of 3 — Tell us who you are</p>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input type="text" value={form.name} onChange={set('name')} placeholder="Your full name"
                                        className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors placeholder:text-gray-600" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input type="email" value={form.email} onChange={set('email')} placeholder="name@company.com"
                                        className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white text-sm focus:outline-none focus:border-primary-500 transition-colors placeholder:text-gray-600" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 1 — Plan selection */}
                    {step === 1 && (
                        <div className="space-y-5">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-1">Choose Your Plan</h2>
                                <p className="text-sm text-gray-400">Step 2 of 3 — Select a subscription tier</p>
                            </div>
                            <div className="space-y-2">
                                {PLANS.map(p => (
                                    <label key={p.id}
                                        className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                                            form.plan === p.id
                                                ? 'border-primary-500 bg-primary-500/10'
                                                : 'border-white/10 bg-black/20 hover:bg-white/5'
                                        }`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                                form.plan === p.id ? 'border-primary-500' : 'border-gray-600'
                                            }`}>
                                                {form.plan === p.id && <div className="w-2 h-2 rounded-full bg-primary-500" />}
                                            </div>
                                            <input type="radio" className="hidden" value={p.id} checked={form.plan === p.id} onChange={set('plan')} />
                                            <div>
                                                <span className="text-sm font-bold text-white">{p.label}</span>
                                                <span className="text-xs text-gray-400 ml-2">· {p.credits} credits/mo</span>
                                            </div>
                                        </div>
                                        <span className="text-sm font-bold text-primary-400">{p.price}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 2 — Summary */}
                    {step === 2 && (
                        <div className="space-y-5">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-1">Review & Confirm</h2>
                                <p className="text-sm text-gray-400">Step 3 of 3 — Confirm your subscription request</p>
                            </div>
                            <div className="space-y-3">
                                {[
                                    { icon: User,       label: 'Name',     value: form.name         },
                                    { icon: Mail,       label: 'Email',    value: form.email        },
                                    { icon: Tag,        label: 'Plan',     value: selectedPlan.label},
                                    { icon: CreditCard, label: 'Price',    value: selectedPlan.price},
                                    { icon: CheckCircle2,label: 'Credits', value: `${selectedPlan.credits} / month` },
                                ].map(({ icon: Icon, label, value }) => (
                                    <div key={label} className="flex items-center gap-4 p-3 bg-black/30 rounded-xl border border-white/5">
                                        <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
                                        <span className="text-xs text-gray-400 w-16 flex-shrink-0">{label}</span>
                                        <span className="text-sm font-semibold text-white">{value}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed bg-white/5 rounded-xl p-3 border border-white/5">
                                No payment is processed at this time. This is a subscription request. 
                                Payment gateway integration coming soon.
                            </p>
                        </div>
                    )}

                    {/* CTA */}
                    <button
                        onClick={handleNext}
                        disabled={!canNext() || isProcessing}
                        className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /><span>Processing...</span></>
                        ) : step < 2 ? (
                            <><span>Continue</span><ChevronRight className="w-4 h-4" /></>
                        ) : (
                            <><CheckCircle2 className="w-4 h-4" /><span>Subscribe Now</span></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Subscribe;
