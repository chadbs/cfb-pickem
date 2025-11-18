import React from 'react';

export default function Header() {
    return (
        <header className="bg-field-dark text-white p-6 shadow-lg border-b-4 border-endzone">
            <div className="container mx-auto flex justify-between items-center">
                <h1 className="text-4xl font-display font-bold tracking-wider uppercase italic">
                    Gameday <span className="text-endzone">Pick'em</span>
                </h1>
                <div className="text-sm font-mono bg-black/30 px-3 py-1 rounded">
                    Season 2025
                </div>
            </div>
        </header>
    );
}
