module.exports = {
	// Allan, explain how this works.
	async CheckLineBox(B1, B2, L1, L2) {
		let Hit = {x: L2.x, y: L2.y, z: L2.z};
		function GetIntersection(fDst1, fDst2, P1, P2) {
			if ( (fDst1 * fDst2) >= 0.0) {return false;}
			if ( fDst1 == fDst2) {return false}
			Hit.x = P1.x + (P2.x-P1.x) * ( -fDst1/(fDst2-fDst1) );
			Hit.y = P1.y + (P2.y-P1.y) * ( -fDst1/(fDst2-fDst1) );
			Hit.z = P1.z + (P2.z-P1.z) * ( -fDst1/(fDst2-fDst1) );
			return true;
		}
		function InBox( Hit, B1, B2, Axis) {
			if ( Axis==1 && Hit.z > B1.z && Hit.z < B2.z && Hit.y > B1.y && Hit.y < B2.y) {return true;}
			if ( Axis==2 && Hit.z > B1.z && Hit.z < B2.z && Hit.x > B1.x && Hit.x < B2.x) {return true;}
			if ( Axis==3 && Hit.x > B1.x && Hit.x < B2.x && Hit.y > B1.y && Hit.y < B2.y) {return true;}
			return false;
		}
		if (L2.x < B1.x && L1.x < B1.x) {return false;}
		if (L2.x > B2.x && L1.x > B2.x) {return false;}
		if (L2.y < B1.y && L1.y < B1.y) {return false;}
		if (L2.y > B2.y && L1.y > B2.y) {return false;}
		if (L2.z < B1.z && L1.z < B1.z) {return false;}
		if (L2.z > B2.z && L1.z > B2.z) {return false;}
		if (L1.x > B1.x && L1.x < B2.x &&
		    L1.y > B1.y && L1.y < B2.y &&
		    L1.z > B1.z && L1.z < B2.z) 
		    {Hit = L1; 
    			return true;}
		if ( (GetIntersection( L1.x-B1.x, L2.x-B1.x, L1, L2) && InBox( Hit, B1, B2, 1 ))
		  || (GetIntersection( L1.y-B1.y, L2.y-B1.y, L1, L2) && InBox( Hit, B1, B2, 2 )) 
		  || (GetIntersection( L1.z-B1.z, L2.z-B1.z, L1, L2) && InBox( Hit, B1, B2, 3 )) 
		  || (GetIntersection( L1.x-B2.x, L2.x-B2.x, L1, L2) && InBox( Hit, B1, B2, 1 )) 
		  || (GetIntersection( L1.y-B2.y, L2.y-B2.y, L1, L2) && InBox( Hit, B1, B2, 2 )) 
		  || (GetIntersection( L1.z-B2.z, L2.z-B2.z, L1, L2) && InBox( Hit, B1, B2, 3 )))
			{return true;}
	
		return false;
	}
}