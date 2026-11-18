/*
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.  You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  See the
 * License for the specific language governing permissions and limitations
 * under the License.
 * Modified by Lingfern on 2026-11-18 to fix a null dereference and input ownership.
 */



#include <cstddef>
#include <fstream>
#include <math.h>
#include <unistd.h>
#include <sstream>
#include <iostream>
#include <vector>
#include <list>

#include "AnsHeap.h"
#include "AnswerTree.h"
#include "Bchart.h"
#include "Bst.h"
#include "ChartBase.h"
#include "ECArgs.h"
#include "ECString.h"
#include "ewDciTokStrm.h"
#include "extraMain.h"
#include "GotIter.h"
#include "headFinder.h"
#include "InputTree.h"
#include "Link.h"
#include "MeChart.h"
// #include "Params.h"
#include "ParseStats.h"
#include "ScoreTree.h"
#include "SentRep.h"
#include "TimeIt.h"
#include "UnitRules.h"
#include "utils.h"
#include "Wrd.h"


// load_model = Module.cwrap('load_model', null, ['string'])
// load_model("EN-DATA/")
// parse_sentence = Module.cwrap('parse_sentence', null, ['string'])
// set_pretty = Module.cwrap('set_pretty', null, ['number'])
// set_case = Module.cwrap('set_case', null, ['number'])
// set_nth = Module.cwrap('set_nth', null, ['number'])

// set_pretty(true)
// parse_sentence("<s> He'll work at the chocolate factory. </s>\n")

extern "C" {

static const double log600 = log2(600.0);
int sentenceCount=0; // allow extern'ing for error messages

void load_model(const char* path) {
    // ECString myCppString = path;
    generalInit(path);
}

void set_pretty(bool pretty){
	Bchart::prettyPrint = pretty;
}

void set_case(bool sensitive){
	Bchart::caseInsensitive = sensitive;
}

void set_nth(int nth){
	Bchart::Nth = nth;
}

/* In order to print out the data in the correct order each
thread has it's own PrintStack which stores the output data
(printStrict) until it is time to print it out in order.
*/
typedef struct printStruct{
  int                sentenceCount;
  int                numDiff;
  vector<InputTree*> trees;
  vector<double>     probs;
  string             name;
} printStruct;


void printOutput(printStruct pstr){
	// if(pstr.sentenceCount != printCount) break;
	if(Bchart::Nth > 1) {
		// int sentenceCount = 0;
		ECString index = pstr.name.empty() ? intToString(sentenceCount): pstr.name;
		cout << pstr.numDiff << "\t" << index <<"\n";
	}
	// printCount++;
	for(int i = 0 ; i < pstr.numDiff ; i++){
		InputTree*  mapparse = pstr.trees[i];
		assert(mapparse);
		double logP =log2(pstr.probs[i]);
		logP -= (mapparse->length()*log600);
		// if (Bchart::Nth > 1) {
		cout << logP << "\n";	
		// }else if (!pstr.name.empty())  {
		// 	cout << "<" << pstr.name << "> "; 	
		// }

		if (Bchart::prettyPrint) {
			cout << *mapparse << "\n\n";
		}else{
			mapparse->printproper(cout);
			cout << "\n";
		}
		delete mapparse;
	}
	cout << endl;
}


void parse_sentence(const char* text){
    int expectedTokens = 10;
    int id = 0;

    istringstream inputstream(text);
    ewDciTokStrm* tokStream = new ewDciTokStrm(inputstream);
    // not sure why we need an extra read here, but the first word is null
    // otherwise
    tokStream->read();

    SentRep* srp = new SentRep(expectedTokens);
    *tokStream >> *srp;
    delete tokStream;


	printStruct printS;
	printS.name = srp->getName();
	printS.sentenceCount = 0;
	printS.numDiff = 0;

	int len = srp->length();
    if (len == 0) { delete srp; return; }

    // handle input containing reserved word Bchart::HEADWORD_S1; could probably do 
    // better (like undo replacement before printing) but this seems sufficient.
	for (int i = 0; i < len; ++i)  {
		ECString& w = ((*srp)[i]).lexeme();
		if (w == Bchart::HEADWORD_S1)  {
			ECString msg = ECString("Replacing reserved token \"") + Bchart::HEADWORD_S1;
			msg += "\" at index " + intToString(i) + " of input with token \"^^^\"";
			WARN( msg.c_str() );
			w = "^^^";
		}
	}

	MeChart* chart = new MeChart(*srp, id);
	chart->parse();

	Item* topS = chart->topS();
	if(!topS) {
		WARN( "Parse failed: !topS" );
		// printSkipped(srp,chart,printStack,printS);
		delete chart;
        delete srp;
		return;
	}

	// compute the outside probabilities on the items so that we can
	// skip doing detailed computations on the really bad ones 
	chart->set_Alphas();

	Bst& bst = chart->findMapParse();
	if( bst.empty()) {
		WARN( "Parse failed: chart->findMapParse().empty()" );
		// printSkipped(srp,chart,printStack,printS);
		delete chart;
        delete srp;
		return;
	}
	if(Feature::isLM) {
		double lgram = log2(bst.sum());
		lgram -= (len*log600);
		double pgram = pow(2,lgram);
		double iptri =chart->triGram();;
		double ltri = (log2(iptri)-len*log600);
		double ptri = pow(2.0,ltri);
		double pcomb = (0.667 * pgram)+(0.333 * ptri);
		double lmix = log2(pcomb);
		// if(locCount%10==9) 
		cout << lgram << "\t" << ltri << "\t" << lmix << "\n";
	}
	Link diffs(0);
	//cerr << "Need num diff: " << Bchart::Nth << endl;
	for(int numVersions = 0 ; ; numVersions++){
		short pos = 0;
		Val* v = bst.next(numVersions);
		if(!v) break;
		double vp = v->prob();
		if(vp == 0) break;
		if(isnan(vp)) break;
		if(isinf(vp)) break;
		InputTree* mapparse=inputTreeFromBsts(v,pos,*srp);
		bool isU;
		int cnt = 0;
		diffs.is_unique(mapparse, isU,cnt);
		if(cnt != len){
			cerr << "Bad length parse for: " << *srp << endl;
			cerr << *mapparse << endl;
			assert(cnt == len);
		}
		if(isU){
			printS.probs.push_back(v->prob());
			printS.trees.push_back(mapparse);
			printS.numDiff++;
		}else{
			delete mapparse;
		}
		if(printS.numDiff >= Bchart::Nth) break;
		if(numVersions > 20000) break;
	}
	if( printS.numDiff == 0){
		WARN( "Parse failed from 0, inf or nan probabililty" );
		// printSkipped(srp,chart,printStack,printS);
		delete chart;
        delete srp;
		return;
	}

	printOutput(printS);

	delete chart;
	delete srp;

}





}