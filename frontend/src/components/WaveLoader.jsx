import React from 'react';

const WaveLoader = ({ color = 'bg-white', size = 'md', className = '' }) => {
    const sizeClasses = {
        sm: 'w-1 h-2',
        md: 'w-1 h-3',
        lg: 'w-1.5 h-4',
        xl: 'w-2 h-6'
    };
    
    const h = sizeClasses[size] || sizeClasses.md;

    return (
        <div className={`flex items-center gap-1 inline-flex ${className}`}>
            <div className={`rounded-full wave-anim ${h} ${color}`} style={{ animationDelay: '0ms' }}></div>
            <div className={`rounded-full wave-anim ${h} ${color}`} style={{ animationDelay: '200ms' }}></div>
            <div className={`rounded-full wave-anim ${h} ${color}`} style={{ animationDelay: '400ms' }}></div>
        </div>
    );
};

export default WaveLoader;
