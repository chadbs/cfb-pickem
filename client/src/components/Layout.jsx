import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Trophy, BarChart2, Grid, Shield } from 'lucide-react';
import clsx from 'clsx';

import HeaderUserMenu from './HeaderUserMenu';

                                        <Icon size={18} />
                                        <span>{item.label}</span>
                                    </Link >
                                );
                            })}
                        </div >

    {/* User Menu (Top Right) */ }
    < HeaderUserMenu
currentUser = { currentUser }
users = { users || []}
onUserSwitch = { onUserSwitch }
    />
                    </div >
                </div >
            </nav >

    {/* Mobile Bottom Nav */ }
    < div className = "md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-safe" >
        <div className="flex justify-around items-center h-16">
            {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={clsx(
                            "flex flex-col items-center justify-center w-full h-full space-y-1",
                            isActive ? "text-field-dark" : "text-gray-400"
                        )}
                    >
                        <Icon size={24} className={clsx(isActive && "fill-current")} />
                        <span className="text-[10px] font-bold">{item.label}</span>
                    </Link>
                );
            })}
        </div>
            </div >

    {/* Main Content */ }
    < main className = "flex-1 container mx-auto px-4 py-6 mb-16 md:mb-0" >
        { children }
            </main >
        </div >
    );
}
